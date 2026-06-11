/*
	@title
		tscwinsock
	@author
		tscwinsock
	@copyright
		2025

	tscwinsock is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	tscwinsock is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with tscwinsock.  If not, see <http://www.gnu.org/licenses/>.
*/
//=======================================================
#pragma once

#include <string>
#include <vector>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <functional>
#include <Windows.h>

#include "cidr.h"
#include "portscan.h"

namespace __TSCSOCKET__ {

	typedef void(*ScanResultCallback)(PortResult result);
	typedef void(*ScanDoneCallback)();
	typedef void(*ScanProgressCallback)(int completed, int total, const char* currentTarget);

	struct ScanJob {
		char ip[46];
		int port;
	};

	class Scanner {
	private:
		std::queue<ScanJob> jobQueue;
		std::vector<std::thread> workers;
		std::mutex queueMutex;
		std::condition_variable cv;
		std::atomic<bool> running;
		std::atomic<bool> paused;
		std::atomic<int> jobsCompleted;
		int totalJobs;
		int maxConcurrency;
		int scanTimeout;
		bool grabBanner;
		int bannerMaxLen;

		ScanResultCallback resultCb;
		ScanDoneCallback doneCb;
		ScanProgressCallback progressCb;

		std::string currentTarget;

		void workerThread() {
			while (running) {
				ScanJob job;
				{
					std::unique_lock<std::mutex> lock(queueMutex);
					cv.wait(lock, [this] {
						return !running || (!paused && !jobQueue.empty());
					});

					if (!running) return;
					if (jobQueue.empty()) continue;

					job = jobQueue.front();
					jobQueue.pop();
				}

				currentTarget = std::string(job.ip) + ":" + std::to_string(job.port);

				char banner[1024] = { 0 };
				int status = __scanPort(job.ip, job.port, scanTimeout,
					grabBanner ? banner : NULL,
					grabBanner ? min(bannerMaxLen, 1023) : 0);

				PortResult res;
				strcpy_s(res.ip, sizeof(res.ip), job.ip);
				res.port = job.port;
				res.status = status;
				strcpy_s(res.banner, sizeof(res.banner), banner);

				if (resultCb)
					resultCb(res);

				jobsCompleted++;

				if (progressCb)
					progressCb(jobsCompleted, totalJobs, currentTarget.c_str());

				{
					std::lock_guard<std::mutex> lock(queueMutex);
				}
				cv.notify_one();
			}
		}

	public:
		Scanner() :
			running(false),
			paused(false),
			jobsCompleted(0),
			totalJobs(0),
			maxConcurrency(100),
			scanTimeout(2000),
			grabBanner(false),
			bannerMaxLen(512),
			resultCb(nullptr),
			doneCb(nullptr),
			progressCb(nullptr)
		{}

		~Scanner() {
			abort();
		}

		void setConcurrency(int max) { maxConcurrency = max > 0 ? max : 1; }
		void setTimeout(int ms) { scanTimeout = ms > 0 ? ms : 1000; }
		void setBanner(bool enable) { grabBanner = enable; }
		void setBannerLen(int len) { bannerMaxLen = len > 0 ? (len < 1024 ? len : 1023) : 512; }

		void onResult(ScanResultCallback cb) { resultCb = cb; }
		void onDone(ScanDoneCallback cb) { doneCb = cb; }
		void onProgress(ScanProgressCallback cb) { progressCb = cb; }

		void scan(const char* target, const char* portStr) {
			if (running) return;

			auto ips = __parseTargets(target);
			auto ports = __parsePorts(portStr);

			for (const auto& ip : ips) {
				for (int p : ports) {
					ScanJob job;
					strcpy_s(job.ip, sizeof(job.ip), ip.c_str());
					job.port = p;
					jobQueue.push(job);
				}
			}

			totalJobs = (int)jobQueue.size();
			jobsCompleted = 0;
			running = true;
			paused = false;

			int numWorkers = min(maxConcurrency, totalJobs);
			for (int i = 0; i < numWorkers; i++)
				workers.emplace_back(&Scanner::workerThread, this);
		}

		void run() {
			if (!running && !jobQueue.empty()) {
				running = true;
				paused = false;
				int numWorkers = min(maxConcurrency, (int)jobQueue.size());
				for (int i = 0; i < numWorkers; i++)
					workers.emplace_back(&Scanner::workerThread, this);
			}
		}

		void wait() {
			for (auto& t : workers)
				if (t.joinable()) t.join();
			workers.clear();
			running = false;
			if (doneCb) doneCb();
		}

		void abort() {
			running = false;
			paused = false;
			cv.notify_all();
			wait();
			std::lock_guard<std::mutex> lock(queueMutex);
			while (!jobQueue.empty()) jobQueue.pop();
			totalJobs = 0;
			jobsCompleted = 0;
		}

		void pause() {
			paused = true;
		}

		void unpause() {
			paused = false;
			cv.notify_all();
		}

		int getProgress() const {
			return totalJobs > 0 ? (jobsCompleted * 100 / totalJobs) : 0;
		}

		int getCompleted() const { return jobsCompleted; }
		int getTotal() const { return totalJobs; }
	};
}
