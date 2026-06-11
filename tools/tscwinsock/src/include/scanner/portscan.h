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
#include <winsock2.h>
#include <ws2tcpip.h>

#pragma comment(lib, "Ws2_32.lib")

namespace __TSCSOCKET__ {

#define PORTSCAN_OPEN		0
#define PORTSCAN_CLOSED		1
#define PORTSCAN_TIMEOUT	2
#define PORTSCAN_REFUSED	3
#define PORTSCAN_UNREACH	4
#define PORTSCAN_ERROR		5

	struct PortResult {
		char ip[46];
		int port;
		int status;
		char banner[1024];
	};

	inline void __iacNegotiate(char* buf, int& len, SOCKET s) {
		unsigned char iac_cmd[] = { 0xFF, 0xFC, 0x18 };
		for (int i = 0; i < len - 2; i++) {
			if ((unsigned char)buf[i] == 0xFF) {
				int remaining = len - i;
				if (remaining >= 3) {
					send(s, (char*)iac_cmd, 3, 0);
					memmove(buf + i, buf + i + 3, remaining - 3);
					len -= 3;
					i--;
				}
			}
		}
	}

	inline void __cleanupWSA(PADDRINFOA pAddr, SOCKET s) {
		if (s != INVALID_SOCKET) closesocket(s);
		if (pAddr) freeaddrinfo(pAddr);
		WSACleanup();
	}

	inline int __scanPort(const char* ip, int port, int timeoutMs, char* bannerOut, int bannerLen) {
		WSADATA wsaData;
		SOCKET s = INVALID_SOCKET;
		struct addrinfo hints, * res = NULL;
		char portStr[8];
		int result = PORTSCAN_CLOSED;

		if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0)
			return PORTSCAN_ERROR;

		ZeroMemory(&hints, sizeof(hints));
		hints.ai_family = AF_INET;
		hints.ai_socktype = SOCK_STREAM;
		hints.ai_protocol = IPPROTO_TCP;

		sprintf_s(portStr, "%d", port);
		if (getaddrinfo(ip, portStr, &hints, &res) != 0) {
			__cleanupWSA(res, s);
			return PORTSCAN_ERROR;
		}

		s = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
		if (s == INVALID_SOCKET) {
			__cleanupWSA(res, s);
			return PORTSCAN_ERROR;
		}

		u_long mode = 1;
		ioctlsocket(s, FIONBIO, &mode);

		int connResult = connect(s, res->ai_addr, (int)res->ai_addrlen);
		if (connResult == SOCKET_ERROR) {
			int wsaErr = WSAGetLastError();
			if (wsaErr != WSAEWOULDBLOCK) {
				if (wsaErr == WSAECONNREFUSED) result = PORTSCAN_REFUSED;
				else if (wsaErr == WSAEHOSTUNREACH || wsaErr == WSAENETUNREACH) result = PORTSCAN_UNREACH;
				else result = PORTSCAN_CLOSED;
				__cleanupWSA(res, s);
				return result;
			}
		}

		fd_set fdWrite, fdErr;
		FD_ZERO(&fdWrite);
		FD_ZERO(&fdErr);
		FD_SET(s, &fdWrite);
		FD_SET(s, &fdErr);

		struct timeval tv;
		tv.tv_sec = timeoutMs / 1000;
		tv.tv_usec = (timeoutMs % 1000) * 1000;

		int selResult = select(0, NULL, &fdWrite, &fdErr, &tv);
		if (selResult == 0) {
			result = PORTSCAN_TIMEOUT;
		}
		else if (selResult == SOCKET_ERROR) {
			result = PORTSCAN_ERROR;
		}
		else if (FD_ISSET(s, &fdErr)) {
			result = PORTSCAN_CLOSED;
		}
		else if (FD_ISSET(s, &fdWrite)) {
			result = PORTSCAN_OPEN;
			mode = 0;
			ioctlsocket(s, FIONBIO, &mode);

			if (bannerOut && bannerLen > 0) {
				fd_set fdRead;
				FD_ZERO(&fdRead);
				FD_SET(s, &fdRead);

				struct timeval bannerTv;
				bannerTv.tv_sec = 1;
				bannerTv.tv_usec = 0;

				int totalRead = 0;
				while (totalRead < bannerLen - 1) {
					int rSel = select(0, &fdRead, NULL, NULL, &bannerTv);
					if (rSel <= 0) break;

					char buf[256];
					int r = recv(s, buf, min(256, bannerLen - 1 - totalRead), 0);
					if (r <= 0) break;

					__iacNegotiate(buf, r, s);
					int copyLen = min(r, bannerLen - 1 - totalRead);
					memcpy(bannerOut + totalRead, buf, copyLen);
					totalRead += copyLen;
				}
				bannerOut[totalRead] = '\0';
			}
		}

		__cleanupWSA(res, s);
		return result;
	}
}
