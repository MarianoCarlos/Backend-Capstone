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

io.on("connection", (socket) => {
	console.log("✅ New user connected:", socket.id);

	// Join a room
	socket.on("join-room", (room) => {
		console.log(`📌 User ${socket.id} joined room ${room}`);
		socket.join(room);
		socket.to(room).emit("new-user", socket.id);
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
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
