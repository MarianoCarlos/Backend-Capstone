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
		origin: "*",
		methods: ["GET", "POST"],
	},
});

io.on("connection", (socket) => {
	console.log("New user connected:", socket.id);

	// Join room
	socket.on("join-room", (room) => {
		socket.join(room);
		console.log(`${socket.id} joined room ${room}`);
		// Notify all others in the room
		socket.to(room).emit("new-user", socket.id);
	});

	// Forward offer
	socket.on("offer", ({ sdp, to }) => {
		io.to(to).emit("offer", { sdp, from: socket.id });
	});

	// Forward answer
	socket.on("answer", ({ sdp, to }) => {
		io.to(to).emit("answer", { sdp, from: socket.id });
	});

	// Forward ICE candidate
	socket.on("ice-candidate", ({ candidate, to }) => {
		io.to(to).emit("ice-candidate", { candidate });
	});

	// End call
	socket.on("end-call", ({ to }) => {
		io.to(to).emit("end-call"); // Notify remote
	});

	// Disconnect
	socket.on("disconnecting", () => {
		const rooms = [...socket.rooms].filter((r) => r !== socket.id);
		rooms.forEach((room) => {
			socket.to(room).emit("end-call"); // Notify all peers in the room
		});
	});

	socket.on("disconnect", () => {
		console.log("User disconnected:", socket.id);
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
