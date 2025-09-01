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
		origin: "*", // Change this to your frontend URL in production
		methods: ["GET", "POST"],
	},
});

io.on("connection", (socket) => {
	console.log("New user connected:", socket.id);

	// Join a room
	socket.on("join-room", (room) => {
		socket.join(room);
		socket.to(room).emit("new-user", socket.id);
	});

	// WebRTC offer
	socket.on("offer", ({ sdp, to }) => {
		io.to(to).emit("offer", { sdp, from: socket.id });
	});

	// WebRTC answer
	socket.on("answer", ({ sdp, to }) => {
		io.to(to).emit("answer", { sdp, from: socket.id });
	});

	// ICE candidates
	socket.on("ice-candidate", ({ candidate, to }) => {
		io.to(to).emit("ice-candidate", { candidate });
	});

	// End call
	socket.on("end-call", ({ to }) => {
		if (to) io.to(to).emit("end-call");
	});

	// Handle disconnect
	socket.on("disconnect", () => {
		console.log("User disconnected:", socket.id);
		Array.from(socket.rooms)
			.filter((room) => room !== socket.id) // exclude socket's own room
			.forEach((room) => socket.to(room).emit("end-call"));
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
