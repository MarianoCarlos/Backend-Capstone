// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// ✅ Health check
app.get("/", (req, res) => {
	res.send("✅ ASL Video Call Backend is running!");
});

const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: [
			"https://www.insyncweb.site",
			"https://insync-omega.vercel.app",
			"http://localhost",
			"http://localhost:3000",
		],
		methods: ["GET", "POST"],
		credentials: true,
	},
});

// ==================================================================
// 🌐 CONNECTION MANAGEMENT
// ==================================================================
const users = new Map(); // socket.id → { room, uid, name, userType }
const uidToSocket = new Map(); // uid → socket.id
const pendingCandidates = new Map(); // uid → [{ from, candidate }]

// ==================================================================
// 🔌 SOCKET EVENTS
// ==================================================================
io.on("connection", (socket) => {
	console.log("✅ User connected:", socket.id);

	// 🔹 Register user with Firebase info
	socket.on("register-user", ({ room, uid, name, userType }) => {
		// Store user info
		users.set(socket.id, { room, uid, name, userType });
		uidToSocket.set(uid, socket.id);
		socket.join(room);

		console.log(`📌 Registered ${name} (${userType}) in room ${room}`);

		// 🔁 Send any queued ICE candidates waiting for this UID
		if (pendingCandidates.has(uid)) {
			const queued = pendingCandidates.get(uid);
			queued.forEach(({ from, candidate }) => {
				io.to(socket.id).emit("ice-candidate", { candidate, from });
			});
			pendingCandidates.delete(uid);
			console.log(`🧊 Flushed ${queued.length} pending ICE candidates for ${uid}`);
		}

		// ✅ Notify everyone (including sender) of this user
		io.to(room).emit("user-info", { uid, name, userType, socketId: socket.id });

		// ✅ Send existing users' info back to the new user
		const existingUsers = Array.from(io.sockets.adapter.rooms.get(room) || [])
			.filter((id) => id !== socket.id)
			.map((id) => users.get(id));

		existingUsers.forEach((u) => {
			if (u) {
				socket.emit("user-info", {
					uid: u.uid,
					name: u.name,
					userType: u.userType,
					socketId: uidToSocket.get(u.uid),
				});
			}
		});
	});

	// 🔹 Manual room join (fallback)
	socket.on("join-room", (room) => {
		console.log(`👋 ${socket.id} joined room ${room}`);
		socket.join(room);
		socket.to(room).emit("new-user", socket.id);
	});

	// ==================================================================
	// 🎥 WebRTC SIGNALING
	// ==================================================================
	socket.on("offer", ({ sdp, to }) => {
		const targetSocketId = uidToSocket.get(to) || to;
		if (targetSocketId) {
			console.log(`📡 Offer: ${socket.id} → ${targetSocketId}`);
			io.to(targetSocketId).emit("offer", { sdp, from: socket.id });
		} else {
			console.warn(`⚠️ Offer target not found: ${to}`);
		}
	});

	socket.on("answer", ({ sdp, to }) => {
		const targetSocketId = uidToSocket.get(to) || to;
		if (targetSocketId) {
			console.log(`📡 Answer: ${socket.id} → ${targetSocketId}`);
			io.to(targetSocketId).emit("answer", { sdp, from: socket.id });
		} else {
			console.warn(`⚠️ Answer target not found: ${to}`);
		}
	});

	socket.on("ice-candidate", ({ candidate, to }) => {
		const targetSocketId = uidToSocket.get(to) || to;

		if (targetSocketId && candidate) {
			console.log(`🧊 ICE candidate: ${socket.id} → ${targetSocketId}`);
			io.to(targetSocketId).emit("ice-candidate", { candidate, from: socket.id });
		} else if (candidate && to) {
			console.warn(`⚠️ Target ${to} not found. Queuing ICE candidate.`);
			if (!pendingCandidates.has(to)) pendingCandidates.set(to, []);
			pendingCandidates.get(to).push({ candidate, from: socket.id });

			// 🧹 Auto-clean ICE queue if peer never connects (after 60 seconds)
			setTimeout(() => {
				if (pendingCandidates.has(to)) {
					console.log(`🧼 Cleaning up stale ICE queue for ${to}`);
					pendingCandidates.delete(to);
				}
			}, 60000);
		}
	});

	// ==================================================================
	// 💬 CHAT & TRANSLATION SYNC
	// ==================================================================
	socket.on("new-translation", (data) => {
		const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
		rooms.forEach((room) => {
			socket.to(room).emit("new-translation", data);
		});
	});

	// ==================================================================
	// ❌ DISCONNECT HANDLER
	// ==================================================================
	socket.on("disconnect", () => {
		setTimeout(() => {
			const user = users.get(socket.id);
			if (user) {
				console.log(`❌ ${user.name} (${user.uid}) disconnected`);
				uidToSocket.delete(user.uid);
				users.delete(socket.id);
				socket.to(user.room).emit("user-left", user.uid);
			} else {
				console.log("❌ Socket disconnected:", socket.id);
			}
		}, 1000); // small delay prevents false "user-left" messages
	});
});

// ==================================================================
// 🚀 START SERVER
// ==================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
	console.log(`🚀 Socket server running on port ${PORT}`);
});
