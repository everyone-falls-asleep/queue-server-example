import { useEffect, useState } from "react";
import { EventSourcePolyfill } from "event-source-polyfill";

function App() {
  const [clientId, setClientId] = useState(null);
  const [heartbeatInterval, setHeartbeatInterval] = useState(null);
  const [connectedClients, setConnectedClients] = useState("-");
  const [yourPosition, setYourPosition] = useState("-");
  const [status, setStatus] = useState("Connecting...");
  const token = "my-token";

  useEffect(() => {
    // Initialize SSE connection
    const eventSource = new EventSourcePolyfill("http://localhost:3000/sse", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.clientId) {
          setClientId(data.clientId);
          console.log("Received Client ID:", data.clientId);

          // Start heartbeat
          startHeartbeat(data.clientId);
          return;
        }

        // Ignore Ping messages
        if (data.ping) {
          console.log("Ping message received, ignoring.");
          return;
        }

        setConnectedClients(data.connectedClients);
        setYourPosition(data.yourPosition);
      } catch (error) {
        console.error("Error parsing message:", event.data);
      }
    };

    // Handle connection open
    eventSource.onopen = () => {
      setStatus("Connected");
    };

    // Handle connection errors
    eventSource.onerror = () => {
      setStatus("Error: Connection lost");
      stopHeartbeat();
    };

    // Cleanup on component unmount
    return () => {
      eventSource.close();
      stopHeartbeat();
    };
  }, []); // Empty dependency array to run on mount only

  const startHeartbeat = (clientId) => {
    if (!heartbeatInterval) {
      const interval = setInterval(() => {
        fetch("http://localhost:3000/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: clientId }),
        }).catch((error) => {
          console.error("Heartbeat failed:", error);
        });
      }, 4000);

      setHeartbeatInterval(interval);
    }
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      setHeartbeatInterval(null);
    }
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", margin: "2rem" }}>
      <h1>Server-Sent Events Simulation</h1>
      <p>
        Status:{" "}
        <span
          style={{
            fontWeight: "bold",
            color: status === "Connected" ? "green" : "red",
          }}
        >
          {status}
        </span>
      </p>
      <div className="data" style={{ marginTop: "1rem" }}>
        <h2>Received Data</h2>
        <p>
          <strong>Connected Clients:</strong> {connectedClients}
        </p>
        <p>
          <strong>Your Position:</strong> {yourPosition}
        </p>
      </div>
    </div>
  );
}

export default App;
