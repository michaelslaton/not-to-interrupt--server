# 🔧 Not to Interrupt — Server

This is the **server-side** codebase for **Not to Interrupt**, a real-time collaboration app built to improve communication in online discussions — like podcasts, panels, and group chats.

The server manages rooms, real-time messaging, and event signaling using **Socket.IO**, and it's built with **TypeScript** for type safety and scalability.

---

## 📦 About This Repo

This is the **backend** portion of the app. It provides real-time socket communication and handles room-based interactions such as join requests, user signaling (e.g., AFK, want-to-speak), and more.

It communicates with the front-end React client via **Socket.IO**.

---

## 🧰 Tech Stack

- **Node.js**
- **Socket.IO**
- **TypeScript**
- **ts-node** / **Nodemon** for development
- **dotenv** for environment configuration

---

## 🚀 Features

- 🔌 Real-time communication via Socket.IO
- 📡 Room creation, joining, and leaving
- ✋ Speak/AFK signaling events
- 🔐 Password-protected room support
- 📤 Broadcast updates to connected users
- ♻️ Clean and scalable event structure