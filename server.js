const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
	res.send("Backend is working!");
});

const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
	console.log("New user connected:", socket.id);

	socket.on("join-room", (room) => {
		socket.join(room);
		socket.to(room).emit("new-user", socket.id);
	});

	socket.on("offer", ({ sdp, to }) => io.to(to).emit("offer", { sdp, from: socket.id }));
	socket.on("answer", ({ sdp, to }) => io.to(to).emit("answer", { sdp, from: socket.id }));
	socket.on("ice-candidate", ({ candidate, to }) => io.to(to).emit("ice-candidate", { candidate }));
	socket.on("end-call", ({ to }) => {
		if (to) io.to(to).emit("end-call");
	});

	// Notify others on disconnect
	socket.on("disconnect", () => {
		console.log("User disconnected:", socket.id);
		socket.rooms.forEach((room) => socket.to(room).emit("end-call"));
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
