// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Test route
app.get("/", (req, res) => {
	res.send("Backend is working!");
});

const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "*", // change to your frontend domain in production
		methods: ["GET", "POST"],
	},
});

io.on("connection", (socket) => {
	console.log("✅ New user connected:", socket.id);

	// Join a room
	socket.on("join-room", (room) => {
		const roomInfo = io.sockets.adapter.rooms.get(room);
		const roomSize = roomInfo ? roomInfo.size : 0;

		socket.join(room);
		console.log(`📌 User ${socket.id} joined room ${room} (size: ${roomSize + 1})`);

		// polite = true if already someone in room
		const polite = roomSize > 0;
		socket.to(room).emit("new-user", socket.id, polite);
	});

	// Handle SDP Offer
	socket.on("offer", ({ sdp, to }) => {
		console.log(`📡 Offer from ${socket.id} → ${to}`);
		io.to(to).emit("offer", { sdp, from: socket.id });
	});

	// Handle SDP Answer
	socket.on("answer", ({ sdp, to }) => {
		console.log(`📡 Answer from ${socket.id} → ${to}`);
		io.to(to).emit("answer", { sdp, from: socket.id });
	});

	// Handle ICE Candidates
	socket.on("ice-candidate", ({ candidate, to }) => {
		if (to && candidate) {
			console.log(`🧊 ICE candidate from ${socket.id} → ${to}`);
			io.to(to).emit("ice-candidate", { candidate, from: socket.id });
		}
	});

	// On disconnect
	socket.on("disconnect", () => {
		console.log("❌ User disconnected:", socket.id);
		socket.rooms.forEach((room) => {
			if (room !== socket.id) {
				socket.to(room).emit("user-disconnected", socket.id);
			}
		});
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
