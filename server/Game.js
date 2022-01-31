const Player = require('./Player.js').Player;

// game constructor
Game.games = [];
Game.codes = [];
Game.publicGames = [];

function Game() {
	this.constructor = Game;
	this.dateOpened = new Date();
	this.players = [];
	this.passwords = [];
	this.connections = [];
	this.chat = [];
	this.bannedIps = [];
	this.inGame = false;
	this.gameEnded = false;

	this.board = {};

	this.settings = {		
		
	};

	// pushes game to static game.games
	Game.games.push(this);

	// generates code
	while (!this.code || Game.codes.includes(this.code)) {
		this.code = Math.round(Math.random() * (999999 - 111111) + 111111);
		this.code = this.code.toString();
	}

	// adds code to list
	Game.codes.push(this.code);

	// join function
	this.join = function(name) {
		// checks if players are allowed to join right now
		if(!this.settings.allowPlayersToJoin){
			return {
					failed: true,
					reason: "This game is not allowing new players to join right now."
				}
		}

		// checks if name is taken
		for (let i = 0; i < this.players.length; i++) {
			if (this.players[i].name == name) {
				return {
					failed: true,
					reason: "That username is already taken."
				}
			}
		}

		// generates player
		let player = new Player(name, this);
		player.game = this;
		this.players.push(player);
		this.passwords.push(player.password);

		return player;
	}

	// reset board function
	this.resetBoard = function(){
		this.board = [
			[null, null, null],
			[null, null, null],
			[null, null, null]
		]
	}

	// start game function
	this.startGame = function(player) {
		// removes game from public list
		if (Game.publicGames.includes(this)) Game.publicGames.splice(Game.games.indexOf(this), 1);



		// resets game data
		this.resetBoard();

		// tells players game started
		this.sendMessage({
			action: "recieveMessage",
			messages: [{
				sender: "Moderator",
				date: new Date().toString(),
				message: `${player.name} has started the game.`,
				permission: "village"
			}]
		});

		// assigns roles to players
		this.assignRoles();	

		this.sendMessage({
			action: "recieveMessage",
			messages: [{
				sender: "Moderator",
				date: new Date().toString(),
				message: "So this is the part where you get to know eachother and chat like buddies, you know, before you start murdering eachother in cold blood.",
				permission: "village"
			}]
		});

		// warns that day phase will change in 30 seconds
		setTimeout(() => {
			this.sendMessage({
				action: "recieveMessage",
				messages: [{
					sender: "Moderator",
					date: new Date().toString(),
					message: "It will soon be " + (this.dayPhase.phase == "day" ? "night" : "day") + "...",
					permission: "village"
				}]
			});

			// changes day phase in 10 seconds
			setTimeout(() => {
				this.changeDayPhase();
			}, 10000); // 10000 milliseconds = 10 seconds
			
		}, 30000); // 30000 milliseconds = 30 seconds
	}

	this.assignRoles = function() {
		roles = Roles.generateRoles(this);

		// loops through players
		for (let i = 0; i < this.players.length; i++) {
			currentRole = deepClone(roles[i]);
			this.players[i].role = currentRole;

			// checks if role contains chatViewPermissions
			if (!!currentRole.chatViewPermissions) {
				// puts together list of chatViewPermissions
				for (let j = 0; j < currentRole.chatViewPermissions.length; j++) {
					this.players[i].chatViewPermissions.push({
						name: currentRole.chatViewPermissions[j],
						start: new Date(),
						end: null
					});
				}
			}

			// checks if role contains chatSendPermission
			if (!!currentRole.chatSendPermission) this.players[i].nightChatSendPermission = currentRole.chatSendPermission;

			// adds role data to player
			if (!!currentRole.onMessageEvent) this.players[i].onMessageEvents.push(currentRole.onMessageEvent);
			if (!!currentRole.onDayEndEvent) this.players[i].onDayEndEvents.push(currentRole.onDayEndEvent);
			if (!!currentRole.onNightEndEvent) this.players[i].onNightEndEvents.push(currentRole.onNightEndEvent);
			if (!!currentRole.onDeathEvent) this.players[i].onDeathEvents.push(currentRole.onDeathEvent);
			if (!!currentRole.subfactions) this.players[i].subfactions = this.players[i].subfactions.concat(currentRole.subfactions);

			// tells player about their role
			this.players[i].game.sendMessage({
				action: "recieveMessage",
				messages: [{
					sender: "Moderator",
					message: currentRole.description,
					date: new Date(),
					permission: `user:${this.players[i].name}`
				}]
			});
		}

		// checks if roles are set to be revealed
		if(this.settings.revealRolesInGame){
			let alphabetizedRoles = [];

			// puts names of roles into new array
			for(let i = 0; i < roles.length; i++){
				alphabetizedRoles.push(`<a href="roles/${roles[i].role.name.split(" ").join("%20")}.html">${roles[i].role.name}</a>`);
			}
			
			// alphabetizes roles list
			alphabetizedRoles.sort();

			this.sendMessage({
				action: "recieveMessage",
				messages: [{
					sender: "Moderator",
					date: new Date().toString(),
					message: `This game has the following roles: <br> &nbsp; - ${alphabetizedRoles.join("<br> &nbsp; - ")}`,
					permission: "village"
				}]
			});
		}
	}

	this.waitUntilNextDayPhase = function() {
		// day phase does not change if game is over
		if (this.gameEnded) return;

		// keeps track of minutes passed
		var minutesPassed = 0;

		// waits 30 seconds
		const checkLoop = setInterval(() => {
			// one more minute has passed
			minutesPassed += 0.5;

			// checks how many players are ready
			let livingCount = this.players.length;
			let readyCount = 0;

			// day to night
			if (this.dayPhase.phase == "day") {
				// loops through players to see how many are ready
				for (let i = 0; i < this.players.length; i++) {
					let currentPlayer = this.players[i];

					// does not count dead player
					if (currentPlayer.dead) {
						livingCount--;
						continue;
					}

					if (!!currentPlayer.vote) {
						readyCount++;
					}
				}

				// night to day
			} else {
				// accounts for wolfpack kill
				livingCount++;

				if (!!this.data.wolfpack.targets && this.data.wolfpack.targets.length != 0) {
					readyCount++;
				}

				// loops through players to see how many are ready
				for (let i = 0; i < this.players.length; i++) {
					let currentPlayer = this.players[i];

					// does not count dead player
					if (currentPlayer.dead) {
						livingCount--;
						continue;
					}

					if (currentPlayer.ready) {
						readyCount++;
					}
				}
			}

			// checks if at least 70% of players are ready or if three minutes have passed
			if (readyCount / livingCount > 0.7 || minutesPassed >= 4) {
				clearInterval(checkLoop);

				this.sendMessage({
					action: "recieveMessage",
					messages: [{
						sender: "Moderator",
						date: new Date().toString(),
						message: "It will soon be " + (this.dayPhase.phase == "day" ? "night" : "day") + "...",
						permission: "village"
					}]
				});

				// changes day phase in 10 seconds
				setTimeout(() => {
					this.changeDayPhase();
				}, 10000); // 10000 milliseconds = 10 seconds
			}
		}, 30000); // 30000 milliseconds = 30 seconds
	};

	this.sendMessage = function(message) {
		// adds message to chat list if applicable
		if (message.action == "recieveMessage") {
			this.chat = this.chat.concat(message.messages);
		}

		// loops through all websockets
		for (let i = 0; i < this.connections.length; i++) {
			// alteredMessage will not contain inaccessible messages
			let alteredMessage = deepClone(message);

			if (message.action == "recieveMessage") {
				for (let j = 0; j < alteredMessage.messages.length; j++) {
					// checks if permissions are appropriate for current message
					let permissionIncluded = false;

					var k = 0;

					// loops through permissions and checks if they match
					for (k = 0; k < this.connections[i].player.chatViewPermissions.length; k++) {
						if (this.connections[i].player.chatViewPermissions[k].name == message.messages[j].permission) {
							permissionIncluded = true;
							break;
						}
					}

					// checks if role was had at the time the message was sent
					if (!permissionIncluded || this.connections[i].player.chatViewPermissions[k].start > message.messages[j].date || (!!this.connections[i].player.chatViewPermissions[k].end && this.connections[i].player.chatViewPermissions[k].end < message.messages[j].date)) {
						// removes current message
						alteredMessage.messages.splice(j, 1);

						// subtracts from j to compensate for removed message
						j--;
					}
				}

				// checks if any messages are to be sent
				if (alteredMessage.messages.length > 0) {
					this.connections[i].sendUTF(JSON.stringify(alteredMessage));
				}
			} else {
				this.connections[i].sendUTF(JSON.stringify(alteredMessage));
			}
		}
	}

	this.endGame = function(skipWait = false, alert = true) {
		// loops through players
		for (let i = 0; i < this.players.length; i++) {
			// gives players village chat permission
			this.players[i].chatSendPermission = "village";
		}

		this.gameEnded = true;

		this.sendMessage({
			action: "recieveMessage",
			messages: [{
				sender: "Moderator",
				date: new Date().toString(),
				message: "This game is now over. The game room will automatically close in 10 minutes. You can leave before then, if you wish, by pressing the \"Leave Game\" button at the top of the screen. Thank you for playing.",
				permission: "village"
			}]
		});

		// closes game in five minutes
		setTimeout(() => {
			// kicks out players from frontend
			if(alert){
				this.sendMessage({
					action: "gameClosed",
					message: "This game was closed since it has been over for 10 minutes. Thank you for playing."
				});
			}

			// clears game data
			let index = Game.codes.indexOf(this.code);
			Game.codes.splice(index, 1);
			Game.games.splice(index, 1);
			if (Game.publicGames.includes(this)) Game.publicGames.splice(index, 1);
		}, skipWait ? 0 : 600000); // 600000 milliseconds = 10 minutes


	}

	// closes game if inactive
	setTimeout(() => {
		if (this.inGame == false) {
			this.sendMessage({
				action: "gameClosed",
				message: "This game was closed since it has been open for 15 minutes without starting."
			});

			// clears game data
			let index = Game.codes.indexOf(this.code);
			Game.codes.splice(index, 1);
			Game.games.splice(index, 1);
			if (Game.publicGames.includes(this)) Game.publicGames.splice(index, 1);
		}
	}, 900000); // 900000 milliseconds = 15 minutes
}

// exports game constructor
module.exports = {
	Game
}