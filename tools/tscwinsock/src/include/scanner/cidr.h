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
#include <sstream>
#include <regex>

namespace __TSCSOCKET__ {

	inline unsigned long __ip2long(const std::string& ip) {
		struct in_addr addr;
		inet_pton(AF_INET, ip.c_str(), &addr);
		return ntohl(addr.s_addr);
	}

	inline std::string __long2ip(unsigned long addr) {
		struct in_addr in;
		in.s_addr = htonl(addr);
		char buf[INET_ADDRSTRLEN];
		inet_ntop(AF_INET, &in, buf, INET_ADDRSTRLEN);
		return std::string(buf);
	}

	inline std::vector<std::string> __parseCIDR(const std::string& cidr) {
		std::vector<std::string> ips;
		size_t slash = cidr.find('/');
		if (slash == std::string::npos) {
			ips.push_back(cidr);
			return ips;
		}

		std::string base = cidr.substr(0, slash);
		int prefix = std::stoi(cidr.substr(slash + 1));
		if (prefix < 0 || prefix > 32) return ips;

		unsigned long ip = __ip2long(base);
		unsigned long mask = (prefix == 0) ? 0 : (0xFFFFFFFF << (32 - prefix));
		unsigned long network = ip & mask;
		unsigned long broadcast = network | ~mask;

		for (unsigned long host = network + 1; host < broadcast; host++)
			ips.push_back(__long2ip(host));

		return ips;
	}

	inline std::vector<std::string> __parseIPRange(const std::string& range) {
		std::vector<std::string> ips;
		size_t dash = range.find('-');
		if (dash == std::string::npos) {
			ips.push_back(range);
			return ips;
		}

		std::string start_str = range.substr(0, dash);
		std::string end_str = range.substr(dash + 1);

		if (end_str.find('.') == std::string::npos) {
			size_t last_dot = start_str.rfind('.');
			std::string base = start_str.substr(0, last_dot + 1);
			int start_octet = std::stoi(start_str.substr(last_dot + 1));
			int end_octet = std::stoi(end_str);
			for (int i = start_octet; i <= end_octet; i++)
				ips.push_back(base + std::to_string(i));
		}
		else {
			unsigned long start = __ip2long(start_str);
			unsigned long end = __ip2long(end_str);
			for (unsigned long i = start; i <= end; i++)
				ips.push_back(__long2ip(i));
		}

		return ips;
	}

	inline std::vector<std::string> __parseTargets(const std::string& target) {
		std::vector<std::string> all;
		std::stringstream ss(target);
		std::string part;

		while (std::getline(ss, part, ',')) {
			if (part.find('/') != std::string::npos) {
				auto r = __parseCIDR(part);
				all.insert(all.end(), r.begin(), r.end());
			}
			else if (part.find('-') != std::string::npos) {
				auto r = __parseIPRange(part);
				all.insert(all.end(), r.begin(), r.end());
			}
			else {
				all.push_back(part);
			}
		}
		return all;
	}

	inline std::vector<int> __parsePorts(const std::string& portStr) {
		std::vector<int> ports;
		std::stringstream ss(portStr);
		std::string part;

		while (std::getline(ss, part, ',')) {
			size_t dash = part.find('-');
			if (dash != std::string::npos) {
				int start = std::stoi(part.substr(0, dash));
				int end = std::stoi(part.substr(dash + 1));
				for (int p = start; p <= end; p++)
					ports.push_back(p);
			}
			else {
				ports.push_back(std::stoi(part));
			}
		}
		return ports;
	}
}
