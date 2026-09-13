# DCode Architecture Document

## Overview
DCode is a browser-based, "Mono-Cyber" themed IDE designed for rapid, sandboxed prototyping. It couples a highly optimized, minimalist frontend with an ephemeral containerized backend execution environment.

---

## 1. Functional Requirements

- **File CRUD**: Users can create, read, update, and delete files within a Virtual File System (VFS) map that mirrors the backend container's disk.
- **Code Execution**: The IDE must allow running scripts directly within the sandboxed environment.
- **Terminal Access**: A fully functional, bidirectional pseudo-terminal accessible via the browser, connected to the sandboxed container.

---

## 2. Security Requirements

- **Ephemeral Sessions**: User data and the container environment are completely wiped after the container spins down. This ensures data privacy, resets state between sessions, and effectively manages server resources.
- **Preventing Fork Bombs & Resource Exhaustion**: The Docker container runtime is configured with `--pids-limit` and specific capability drops to prevent malicious escalation or CPU hogging via fork bombs.
- **Network Isolation**: Containers are launched in isolated Docker networks with no outbound internet access unless explicitly permitted by the environment profile.

---

## 3. Resource Limiting

To prevent a single user from crashing the server, strict resource limits are enforced per ephemeral session:
- **CPU**: Hard cap at `0.5` cores per user container.
- **Memory**: Hard cap at `512MB` RAM with swap disabled to ensure predictable memory usage.
- **Disk IO**: Rate-limited I/O and a temporary file system (tmpfs) or volume restricted to `100MB`.

---

## 4. Communication Protocol

We employ a dual-protocol strategy to optimize for both latency and state consistency:

- **WebSockets (Socket.io) for Terminal & Execution**: WebSockets provide a persistent, low-latency, full-duplex connection. This is strictly required for streaming terminal `stdout/stderr` back to the client in real-time, and pushing keystrokes `stdin` to the container's TTY.
- **Standard REST/JSON for File Operations**: While WebSockets handle the terminal, standard HTTP REST endpoints are used for saving and retrieving files. This separation of concerns ensures that file saves are stateless, cacheable, easily retryable on network failure, and don't congest the fast-path WebSocket connection.

---

## 5. Technical Debt & Future Scaling

- **Orchestration**: Currently relying on local Docker daemons (`dockerode` or direct CLI). As traffic increases, this needs to be migrated to Kubernetes (K8s) using dedicated worker nodes and StatefulSets or ephemeral Pods.
- **State Persistence**: If users eventually request saving projects, we will need to implement an S3-compatible blob store or EFS to freeze and thaw container states instead of completely wiping them.
