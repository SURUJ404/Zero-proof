# tscwinsock - Light C++ Winsock Wrapper Library

## Install (Windows)
Simply copy the header files to your project's build directory.

---

## Server Management

```c++
TSCSERVER MyServerName;
MyServerName.start_server( "7777", TCP_SERVER );
```

Creating a server is simply done like the example above. The function takes a port and protocol that it can use. You are allowed to use any protocol that is available with Winsock. Below are some
tscwinsock defined macros for simplicity purposes:

| Protocol | Macro |
| :---:    | :---: |
| TCP | TCP_SERVER |
| IP | IP_SERVER |
| IPV6 | IPV6_SERVER |
| RM | RM_SERVER |
| UDP | UDP_SERVER |

Server control can be managed with the methods below:

```c++
void start_server(PCSTR port, int protocol, FPC_CALLBACK fpConnected=0, FPS_CALLBACK fpData=0, bool thread = true);
void send_data(SOCKET clientSocket, const char * sendChar);
void close();
```

The example earlier showed how simple start_server is; however there are 3 optional arguments. *fpConnected* and *fpData* introduce callbacks for the server. The final argument *thread* controls whether
you want the server to run as a multi-threaded function. The callbacks are important for the server because it allows you to gather information from any client that connects to it. See **server_example.cpp** for a 
complete example.

```c++
void onServerClientConnect( CLIENTDATA info );
void onServerReceiveData(SOCKET clientSocket, CLIENTDATA info, char * data);

int main( )
{
	MyServer.start_server
	( 
		s_port.c_str(), 
		TCP_SERVER, 
		onServerClientConnect, 
		onServerReceiveData,
		false // Letting the server control this thread - true by default
	);
	return 0;
}

void onServerClientConnect( CLIENTDATA info ) { // CLIENTDATA is another keyword for "addrinfo *"
	....
}

void onServerReceiveData(SOCKET clientSocket, CLIENTDATA info, char * data) {
	....
}
```

---

## Client Management

```c++
TSCLIENT  MyClient;
MyClient.init( "my_host_name", "7777", TCP_SERVER, onClientConnect);
```

Creating a client works similiar to creating a server. It's done with a few simple steps. Unlike the server, the onClientConnect argument is not optional. TSCLIENT can be used to connect to other
hosts outside of tscwinsock. Client control can be managed with the methods below:

```c++
bool init( PCSTR server, PCSTR port, int protocol, FPCLIENT_CB fpCB );
bool send_data( const char * sendChar );
void listen( FP_RES fpRes, bool thread = true );
void close();
```

**init** takes a callback argument by FPCLIENT_CB. This callback will trigger once the client has connected to the server. The send_data function is self-explanatory. However, I've created separate methods
that control whether you want a callback to used once the data is sent. By default, the client does not automatically listen for send that is sent from the server. This is why the listen function is here. 
This function accepts a response callback and is threaded by default. Example (see **client_example.cpp** for a full example):

```c++
void onClientConnect();
void onClientSendData( bool result, const char * dataSent );
void OnClientReceiveData( char * data );

int main() {
	TSCLIENT  MyClient;
	bool b_res = MyClient.init( "my_host_name", "7777", TCP_SERVER, onClientConnect);
	
	// Giving the client time to connect.
	Sleep(500);
	
	if( !b_res ) 
	{
		puts("Unable to connect to server");
		exit(0);
	}
	
	MyClient.toggle_send_callback( true );
	MyClient.set_toggle_callback( onClientSendData );
	
	MyClient.send_data( "Hello" );
	MyClient.listen( OnClientReceiveData, false ); // Purposely single-threading this for a response.
	return 0;
}

void onClientConnect() {
	....
}

void onClientSendData( bool result, const char * dataSent ) {
	if( !result )
		printf("Couldn't send %s\n", dataSent );
	else
		puts("Data sent!");
}

void OnClientReceiveData( char * data ) {
	printf("Server says %s\n", data );
}
```

## Buffer

If you plan on sending larger data, define DEFAULT_BUFF before including this library. Or you can redefine DEFAULT_BUFF later on. By default, DEFAULT_BUFF = 512.

---

## Port Scanner

tscwinsock includes a full TCP port scanner. Features:

- IP range, CIDR, or single IP target
- Port range, list, or single port
- Banner grabbing with IAC negotiation (telnet)
- Configurable concurrency and timeout
- Callback-based result reporting
- Progress tracking
- Pause/unpause/abort

### Basic Scan

```c++
#include "tscwinsock.h"

void onResult(PortResult result) {
    const char* statusStr = "";
    switch (result.status) {
        case PORTSCAN_OPEN:     statusStr = "open";     break;
        case PORTSCAN_CLOSED:   statusStr = "closed";   break;
        case PORTSCAN_TIMEOUT:  statusStr = "timeout";  break;
        case PORTSCAN_REFUSED:  statusStr = "refused";  break;
        case PORTSCAN_UNREACH:  statusStr = "unreachable"; break;
    }
    printf("%s|%d|%s|%s\n", result.ip, result.port, statusStr, result.banner);
}

void onDone() {
    printf("Scan complete!\n");
}

int main() {
    __TSCSOCKET__::Scanner scanner;
    
    scanner.setConcurrency(500);
    scanner.setTimeout(2000);
    scanner.setBanner(true);
    scanner.setBannerLen(512);
    
    scanner.onResult(onResult);
    scanner.onDone(onDone);
    
    scanner.scan("192.168.1.0/24", "21-23,80,443");
    scanner.wait();
    
    return 0;
}
```

### Target Formats

| Format | Example | Description |
|--------|---------|-------------|
| Single IP | `192.168.1.1` | One IP address |
| CIDR | `192.168.1.0/24` | Entire subnet |
| IP range | `192.168.1.1-254` | Range in last octet |
| Full range | `192.168.1.1-192.168.1.255` | Full IP range |
| Comma list | `192.168.1.1,192.168.1.2` | Multiple targets |

### Port Formats

| Format | Example | Description |
|--------|---------|-------------|
| Single port | `80` | One port |
| Port range | `20-25` | Inclusive range |
| Comma list | `21,22,80,443` | Multiple ports |
| Mixed | `21-23,80,443-445` | Range + list |

### Concurrency & Performance

- Default concurrency: **100** simultaneous connections
- Increase for faster scans: `scanner.setConcurrency(1000);`
- On Windows, the TCP/IP stack may limit simultaneous connections
- Each connection uses one thread from a pool

### Scanner Methods

```c++
void setConcurrency(int max);     // Max simultaneous connections (default: 100)
void setTimeout(int ms);          // Connection timeout in ms (default: 2000)
void setBanner(bool enable);      // Enable banner grabbing (default: false)
void setBannerLen(int len);       // Max banner length (default: 512)

void onResult(ScanResultCallback cb);   // Called for each scanned port
void onDone(ScanDoneCallback cb);       // Called when scan completes
void onProgress(ScanProgressCallback);  // Called after each port scan

void scan(const char* target, const char* port);  // Start scan
void wait();                                      // Block until scan completes
void abort();                                     // Stop scan immediately
void pause();                                     // Pause scan jobs
void unpause();                                   // Resume scan jobs

int getProgress();  // 0-100
int getCompleted(); // Number of completed jobs
int getTotal();     // Total number of jobs
```
