// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Test route to confirm backend is alive
app.get("/", (req, res) => {
	res.send("Backend is working!");
});

const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "*", // allow frontend from any origin (adjust for production)
		methods: ["GET", "POST"],
	},
});

// 🧠 Store connected users by socket ID → { room, uid, name }
const users = new Map();

io.on("connection", (socket) => {
	console.log("✅ New user connected:", socket.id);

	// 🔹 Register Firebase info when user joins
	socket.on("register-user", ({ room, uid, name }) => {
		users.set(socket.id, { room, uid, name });
		socket.join(room);
		console.log(`📌 Registered user ${name} (${uid}) in room ${room}`);

		// Notify others in the room about this user’s info
		socket.to(room).emit("user-info", { uid, name });
	});

	// 🔹 When someone joins room (legacy support)
	socket.on("join-room", (room) => {
		console.log(`📌 User ${socket.id} joined room ${room}`);
		socket.join(room);
		socket.to(room).emit("new-user", socket.id);
	});

	// 🔹 Handle SDP Offer
	socket.on("offer", ({ sdp, to }) => {
		console.log(`📡 Offer from ${socket.id} → ${to}`);
		io.to(to).emit("offer", { sdp, from: socket.id });
	});

	// 🔹 Handle SDP Answer
	socket.on("answer", ({ sdp, to }) => {
		console.log(`📡 Answer from ${socket.id} → ${to}`);
		io.to(to).emit("answer", { sdp, from: socket.id });
	});

	// 🔹 Handle ICE Candidates
	socket.on("ice-candidate", ({ candidate, to }) => {
		if (to && candidate) {
			console.log(`🧊 ICE candidate from ${socket.id} → ${to}`);
			io.to(to).emit("ice-candidate", { candidate, from: socket.id });
		}
	});

	// 🔹 Handle new translations
	socket.on("new-translation", (data) => {
		const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
		rooms.forEach((room) => {
			socket.to(room).emit("new-translation", data);
		});
	});

	// 🔹 On disconnect
	socket.on("disconnect", () => {
		const user = users.get(socket.id);
		if (user) {
			console.log(`❌ Disconnected: ${user.name} (${user.uid})`);
			users.delete(socket.id);
			socket.to(user.room).emit("user-left", user.uid);
		} else {
			console.log("❌ User disconnected:", socket.id);
		}
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
