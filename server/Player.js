const Game = require("./Game.js");

// player constructor
function Player(name, game, host = false) {
	this.name = name.replace(/[\u00A0-\u9999<>\&]/gim, i => {
		return '&#' + i.charCodeAt(0) + ';'
	}); // removes HTML from name

	this.game = game;
	this.ips = [];
	this.host = host;

	// generates random password for player
	this.password = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

	// connections
	this.connections = [];

	this.leaveGame = function(){
		if(game.inGame && !game.gameEnded){
			// tells player they can't leave game
			for (let i = 0; i < this.connections.length; i++) {
				this.connections[i].sendUTF(JSON.stringify({
					action: "alert",
					message: `You can't leave a game that's already started!`
				}));
			}
			return;
		}

		if(this.game.players.length > 1){
			// leaves from frontend
			for (let i = 0; i < this.connections.length; i++) {
				this.connections[i].sendUTF(JSON.stringify({
					action: "gameClosed",
					message: `You left the game. ${this.game.gameEnded ? `Thank you for playing.` : `Use the code "${this.game.code}" if you want to join back in.`}`
				}));
			}

			// tells other players they left
			this.game.sendMessage({
				action: "recieveMessage",
				messages: [{
					sender: "Moderator",
					message: `${this.name} has left the game.`,
					date: new Date(),
					permission: this.chatSendPermission
				}]
			});

			// checks if game was host
			if(this.host){
				this.game.players[1].host = true;

				// tells other playes there is a new host
				this.game.sendMessage({
					action: "recieveMessage",
					messages: [{
						sender: "Moderator",
						message: `${this.name} used to be host, but since they left, ${this.game.players[1].name} is now host.`,
						date: new Date(),
						permission: this.chatSendPermission
					}]
				});
			}

			// deletes password from game
			this.game.passwords.splice(this.game.passwords.indexOf(this.password), 1);

			// deletes player from game
			this.game.players.splice(this.game.players.indexOf(this), 1);
		} else {
			// leaves from frontend
			for (let i = 0; i < this.connections.length; i++) {
				this.connections[i].sendUTF(JSON.stringify({
					action: "gameClosed",
					message: `You left the game. Since you were the last person in it, the game is now closed.`
				}));
			}

			// closes game since no players are left in it
			this.game.endGame(true, false);
		}
	}
}

// exports player constructor
module.exports = {
	Player
}