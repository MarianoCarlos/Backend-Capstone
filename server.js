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
		origin: "https://insync-sable.vercel.app/", // Replace with your frontend URL in production
		methods: ["GET", "POST"],
	},
});

// Track which socket is in which room and its peer
const rooms = {};

io.on("connection", (socket) => {
	console.log("New user connected:", socket.id);

	// Join a room
	socket.on("join-room", (room) => {
		socket.join(room);

		// Track users in room
		if (!rooms[room]) rooms[room] = [];
		rooms[room].push(socket.id);

		// Notify existing user in the room (1:1)
		const otherUser = rooms[room].find((id) => id !== socket.id);
		if (otherUser) {
			io.to(otherUser).emit("new-user", socket.id);
		}
	});

	// WebRTC offer
	socket.on("offer", ({ sdp, to }) => {
		if (to) io.to(to).emit("offer", { sdp, from: socket.id });
	});

	// WebRTC answer
	socket.on("answer", ({ sdp, to }) => {
		if (to) io.to(to).emit("answer", { sdp, from: socket.id });
	});

	// ICE candidates
	socket.on("ice-candidate", ({ candidate, to }) => {
		if (to) io.to(to).emit("ice-candidate", { candidate });
	});

	// End call
	socket.on("end-call", ({ to }) => {
		if (to) io.to(to).emit("end-call");
	});

	// Disconnect
	socket.on("disconnect", () => {
		console.log("User disconnected:", socket.id);

		// Remove from rooms
		for (const room in rooms) {
			rooms[room] = rooms[room].filter((id) => id !== socket.id);

			// Notify remaining user
			rooms[room].forEach((id) => io.to(id).emit("end-call"));

			// Clean up empty rooms
			if (rooms[room].length === 0) delete rooms[room];
		}
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
