// Node.js Server
var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var path = require('path');
var pg = require('pg');

// Connect to PostgreSQL Database
var connectionString = process.env.DATABASE_URL || 'postgres://postgres:ewoks4life@localhost:5432/boatonline';
var client = new pg.Client(connectionString);
client.connect();

// Use middleware
app.use(express.static(path.join(__dirname + '/public')));

// Routing
app.get('/', function(req, res) {
	res.sendFile(path.join(__dirname + '/startmenu.html'));
});

var port = process.env.PORT || 8888;
server.listen(port, function() {
	console.log('Server listening on port ' + port);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

SOCKET_LIST = {};

var GameObject = function() {
	var self = {
		x: 500,
		y: 400,
		spdX: 0,
		spdY: 0,
		maxSpd: 12,
		accelX: 0,
		accelY: 0,
		id: ''
	};
	self.update = function() {
		self.updatePosition();
	};
	self.updatePosition = function() {
		self.updateSpd();
		self.x += self.spdX;
		self.y += self.spdY;
	};
	self.updateSpd = function() {
		self.spdX += self.accelX;
		self.spdY += self.accelY;

		if(Math.abs(self.spdX) > self.maxSpd) {
			if(self.spdX > 0)
				self.spdX = self.maxSpd;
			else
				self.spdX = -self.maxSpd;
		}
		if(Math.abs(self.spdY) > self.maxSpd) {
			if(self.spdY > 0)
				self.spdY = self.maxSpd;
			else
				self.spdY = -self.maxSpd;
		}
		//if(Math.sqrt(Math.pow(self.spdX, 2) + Math.pow(self.spdY, 2)) > self.maxSpd)

	};
	return self;
};

var numOfPlayers = 0;
var playerNumber = 0;
var FRICTION = 0.1;

var Ball = function(id, playerNum) {
	var self = GameObject();
	self.id = id;
	self.number = playerNum;
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingSkill = false;
	self.maxAccel = 0.3;

	var super_update = self.update;
	self.update = function() {
		self.updateAccel();
		super_update();
	};

	self.updateAccel = function() {
		if(self.pressingRight)
			self.accelX = self.maxAccel;
		else if(self.pressingLeft)
			self.accelX = -self.maxAccel;
		else {
			self.accelX = 0;
			
			// Simulate friction
			if(self.spdX > FRICTION)
				self.spdX -= FRICTION;
			if(self.spdX < -FRICTION)
				self.spdX += FRICTION;
			if(self.spdX >= -FRICTION && self.spdX <= FRICTION)
				self.spdX = 0;
		}

		if(self.pressingUp)
			self.accelY = -self.maxAccel;
		else if(self.pressingDown)
			self.accelY = self.maxAccel;
		else {
			self.accelY = 0;

			// Simulate friction
			if(self.spdY > FRICTION)
				self.spdY -= FRICTION;
			if(self.spdY < -FRICTION)
				self.spdY += FRICTION;
			if(self.spdY >= -FRICTION && self.spdY <= FRICTION)
				self.spdY = 0;
		}

	};

	Ball.list[id] = self;
	return self;
};

Ball.list = {};

Ball.onConnect = function(socket, playerNum) {
	var ball = Ball(socket.id, playerNum);

	// Handle key press event
	socket.on('keyPress', function(data) {
		if(data.inputId === 'left')
			ball.pressingLeft = data.state;
		else if(data.inputId === 'right')
			ball.pressingRight = data.state;
		else if(data.inputId === 'up')
			ball.pressingUp = data.state;
		else if(data.inputId === 'down')
			ball.pressingDown = data.state;
		else if(data.inputId === 'skill')
			ball.pressingSkill = data.state;
	});
};
Ball.onDisconnect = function(socket) {
	delete Ball.list[socket.id];
};
Ball.update = function() {
	var pack = [];
	for(var i in Ball.list) {
		var ball = Ball.list[i];
		ball.update();

		pack.push({
			x: ball.x,
			y: ball.y
		});
	}
	return pack;
};

io.on('connection', function(socket) {
	console.log('User connected');
	numOfPlayers += 1;
	playerNumber += 1;
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	// Have player's number only be between 1 and 4
	if(playerNumber % 4 === 0)
		playerNumber = 4;
	else
		playerNumber = playerNumber % 4;
	Ball.onConnect(socket, playerNumber);

	socket.on('disconnect', function() {
		console.log('User disconnected');
		Ball.onDisconnect(socket);
		delete SOCKET_LIST[socket.id];
		numOfPlayers -= 1;
	});
});


setInterval(function() {
	var pack = {
		ball: Ball.update()
	};

	// Send position to all connected sockets
	for(var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('positionChange', pack);
	}
}, 1000/50);


