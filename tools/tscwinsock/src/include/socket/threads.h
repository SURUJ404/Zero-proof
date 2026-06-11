/*
	@title
		tscwinsock
	@author
		tscwinsock
	@copyright
		2017

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
DWORD WINAPI __TSCSOCKET__::__t__listenThread(LPVOID lpParams) {
	LPTSCLIENT
		c_listen = (LPTSCLIENT)lpParams
	;
	c_listen->__listenfunc(c_listen->fp_params);
	return 0;
}

DWORD WINAPI __TSCSOCKET__::__t__createServerRes(LPVOID lpParams) {
	int							i_result;
	char						c_rec[DEFAULT_BUFF];

	__TSCSOCKET__::s_server_res * Socket_Response = (__TSCSOCKET__::s_server_res *)lpParams;
	do {
		i_result = recv(Socket_Response->SocketResponse, c_rec, DEFAULT_BUFF, 0);
		if (i_result > 0) {
			if (i_result < DEFAULT_BUFF - 1)
				c_rec[i_result] = '\0';

			if(Socket_Response->fpResData != NULL)
				Socket_Response->fpResData( Socket_Response->SocketResponse, Socket_Response->addrRes, c_rec);
		}
		else if (i_result == 0)
#ifdef TSCLOGGER_PLUGIN
			WARNING("%s Connection closed.", TSCSOCKET_PREFIX);
#else
			printf("%s Connection closed.", TSCSOCKET_PREFIX);
#endif
		else
			if (WSAGetLastError() != WSAESHUTDOWN)
#ifdef TSCLOGGER_PLUGIN
				WARNING("%s Issue with server response %d", TSCSOCKET_PREFIX, WSAGetLastError());
#else
				printf("%s Issue with server response %d", TSCSOCKET_PREFIX, WSAGetLastError());
#endif


	} while (i_result > 0);

	return 0;
}
