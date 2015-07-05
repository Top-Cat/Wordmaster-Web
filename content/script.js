var Achievement = function() {};
Achievement.prototype.collect = function(obj) {
	for (p in obj) {
		if (obj.hasOwnProperty(p)) {
			this[p] = obj[p];
		}
	}
	return this;
};
Achievement.prototype.getElement = function() {
	achElem = $('<div/>', {text: this.getDescription()});
	achElem.prepend($('<h1/>', {text: this.getName()}));
	if (this.getState() == "UNLOCKED") {
		unlocked++;
		achElem.prepend($('<span/>', {class: "unlocked"}));
	}
	if (this.getType() == "INCREMENTAL") {
		progress = $('<span/>', {class: "progress"})
			.append(
			$('<span/>',
				{
					class: "text",
					text: this.getProgress(100) + "%"
				}
			)
		);

		circle = $('<span style="-webkit-transform: rotate(' + this.getProgress(360) + 'deg)"></span>')
		.addClass("circle");

		if (this.getProgress() > 0.5) {
			progress
			.append($('<span/>', {class: "circle"}))
			.append(circle);
		} else {
			progress
			.append($('<span/>', {class: "progress_half"})
				.append(circle)
			);
		}

		achElem.prepend(progress);
	} else {
		achElem.prepend($('<img/>', {src: this.getIconUrl()}));
	}
	return achElem;
};
Achievement.prototype.getProgress = function(a) {
	a = typeof a !== "undefined" ? a : 1;
	return d((this.currentSteps ? this.currentSteps : 0) * a, this.totalSteps);
};
Achievement.prototype.getType = function() {
	return this.getState() == "REVEALED" ? this.achievementType : "STANDARD";
};
Achievement.prototype.getIconUrl = function() {
	return (this.achievementState == "HIDDEN" ?
		"image/lock.png" :
		(this.achievementState == "UNLOCKED" ?
			this.unlockedIconUrl :
			this.revealedIconUrl
		)
	);
};
Achievement.prototype.getName = function() {
	return this.achievementState == "HIDDEN" ? "Secret" : this.name;
};
Achievement.prototype.getDescription = function() {
	return this.achievementState == "HIDDEN" ? "Keep playing to learn more" : this.description;
};
Achievement.prototype.getState = function() {
	return this.achievementState == "HIDDEN" ? "REVEALED" : this.achievementState;
};
Achievement.achievements = {};
Achievement.update = function(obj) {
	if (!Achievement.achievements[obj.id]) {
		Achievement.achievements[obj.id] = new Achievement();
	}
	return Achievement.achievements[obj.id].collect(obj);
};
Achievement.count = function() {
	return Object.keys(Achievement.achievements).length;
};
Achievement.result = function(ach) {
	show = (Achievement.count() > 0);
	for (x in ach.items) {
		Achievement.update(ach.items[x]);
	}

	if (show) {
		$('#ach_list').empty();
		unlocked = 0;
		for (x in Achievement.achievements) {
			$('#ach_list').append(Achievement.achievements[x].getElement());
		}
		
		$('#ach_list').prepend(
			$('<h1/>', {text: unlocked + '/' + Achievement.count() + ' unlocked'})
			.append($('<span/>')
				.append($('<b/>', {text: d(unlocked * 100, Achievement.count()) + '%'}))
				.append($('<span/>', {width: d(unlocked * 90, Achievement.count())}))
			)
		);
		$('#achievements').show();
	}
};

// -------------------------------------------------------------------- //

var Error = function() {
	this.errorDiv = $('<div/>', {class: "error"})
		.append(this.nameDiv = $('<h2/>'))
		.append(this.descDiv = $('<p/>'));

	this.queue = [];
	this.visible = false;
};
Error.prototype.getElement = function() {
	return this.errorDiv;
};
Error.prototype.show = function(obj) {
	console.trace();
	this.nextError = obj;
	this.trigger();
};
Error.prototype.trigger = function(obj) {
	if (!this.visible && this.nextError) {
		this.visible = true;

		this.nameDiv.text(this.nextError.name);
		this.descDiv.text(this.nextError.desc);
		this.nextError = false;

		this.errorDiv.css({marginTop: "0px"});
		this.timeout = setTimeout(function(obj) {
			obj.hide.apply(obj);
		}, 5000, this);
	} else {
		this.hide();
	}
};
Error.prototype.hide = function() {
	this.errorDiv.css({marginTop: "-50px"});
	clearTimeout(this.timeout);
	this.timeout = setTimeout(function(obj) {
		obj.visible = false;
		obj.trigger();
	}, 600, this);
};
Error.NETWORK	= {name: "Network Unavailable", desc: "Please check your data connection"};
Error.TURN	= {name: "It's not your turn!", desc: "Wait for your opponent to take their turn."};
Error.WORD	= {name: "Not a word", desc: "That word is not in the Wordmaster dictionary."};
Error.SERVER	= {name: "Server Error", desc: "Something went wrong. Try again later."};
Error.OPPONENT	= {name: "Game not ready", desc: "Opponent hasn't chosen their word yet."};
Error.MATCH	= {name: "Match already exists", desc: "You're already playing against that person."};
Error.WORDSET	= {name: "Word already set", desc: "You've already chosen your word for this game."};
Error.AUTOMATCH	= {name: "Auto match pending", desc: "You're already in the queue for matching."};

// -------------------------------------------------------------------- //

var Match = function() {
	this.turns = [];
	this.error = new Error();

	var keyboard = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
	var offset = 0;
	this.alpha = [];
	this.alphaDiv = $("<div/>", {class: "alpha"});

	for (x in keyboard) {
		var row = $("<div/>");
		for (i = 0; i < keyboard[x].length; i++) {
			row.append(this.alpha[offset] = $("<span/>", {id: "alpha_" + offset++, text: keyboard[x].substr(i, 1)})
				.click({obj: this}, function(event) { $(this).toggleClass('hidden'); event.data.obj.updateAlpha(this.id.substr(6)); })
			);
		}
		this.alphaDiv.append(row);
	}

	this.gameWindow = $('<div/>', {class: "gameWindow"})
	.append($('<div/>', {class: "scores"})
		.append(this.meScoreDiv = $('<div/>', {text: "0"}))
		.append(this.oppScoreDiv = $('<div/>', {text: "0"}))
	)
	.append(this.error.getElement())
	.append(this.turnDiv = $('<div/>', {id: "turns"}))
	.append(this.alphaDiv)
	.append($('<div/>', {id: "footer"})
		.append(this.turnCountDiv = $('<div/>', {class: "turn_count", text: "Turn"})
			.append($('<span/>', {text: "2"}))
		)
		.append($('<div/>', {class: "guess"})
			.append(this.guessDiv = [$('<div/>'), $('<div/>'), $('<div/>'), $('<div/>')])
		)
	);

	this.timeDiv = $('<div/>', {class: "time"});
	this.noteDiv = $('<div/>', {class: "note"});
	this.oppImg = $('<img/>');
	this.textDiv = $('<span/>');

	this.listItem = $('<div/>', {class: "game"})
	.append(this.oppImg)
	.append(this.textDiv)
	.append(this.timeDiv);
};
Match.prototype.showError = function(obj) {
	this.error.show(obj);
};
Match.prototype.getListItem = function() {
	return this.listItem;
};
Match.prototype.getId = function() {
	return this.obj.gameid;
};
Match.prototype.getOpponent = function() {
	return User.get(this.obj.oppid);
};
Match.prototype.getTimeSince = function() {
	return timeSince(this.obj.updated);
};
Match.prototype.isTurn = function() {
	return this.obj.turn || this.obj.needword;
};
Match.prototype.needsWord = function() {
	return this.obj.needword;
};
Match.prototype.update = function(obj) {
	this.obj = obj;

	$('#gamelist > div').append(
		this.getListItem()
		.click($.proxy(function() { this.show(); }, this))
	);

	this.getMoreTurns(0, 0);
	this.updateDOM();

	return this;
};
Match.prototype.getMoreTurns = function(r, e) {
	switch (e) {
		case 0:
			break;
		case 1:
			this.showError(Error.WORD);
			break;
		case 2:
			this.showError(Error.OPPONENT);
			break;
		case 3:
			this.showError(Error.TURN);
			this.obj.turn = false;
			break;
		case 6:
			this.showError(Error.WORDSET);
			this.obj.needword = false;
			break;
		default:
			this.showError(Error.SERVER);
			break;
	}

	this.request(this, "getTurns", this.pivot ? [this.pivot, Match.TURNS_PER_REQUEST] : [], this.turnResult);
};
Match.prototype.updateDOM = function() {
	if (this.getOpponent().isLoaded()) {
		this.oppImg.attr("src", this.getOpponent().getImage());
		this.textDiv.text("vs " + this.getOpponent().getName(true));
	}

	this.listItem.attr("id", this.getId());
	this.timeDiv.text(this.getTimeSince());

	if (this.isTurn()) {
		this.getListItem().append(this.noteDiv);
	} else {
		this.noteDiv.remove();
	}

	for (i = 0; i < 26; i++) {
		this.alpha[i].attr("class", ((this.obj.alpha >> i) & 1) == 1 ? "hidden" : "");
	}

	if (User.me.isLoaded()) {
		this.meScoreDiv.css("background-image", "url('" + User.me.getImage() + "')");
	}
	if (this.getOpponent().isLoaded()) {
		this.oppScoreDiv.css("background-image", "url('" + this.getOpponent().getImage() + "')");
	}

	for (x in this.turns) {
		this.turns[x].updateDOM();
	}
};
Match.prototype.hide = function() {
	this.getListItem().removeClass("selectedgame");

	setTimeout(function(obj) {
		obj.gameWindow.css({top: "100%"});
		setTimeout(function(obj) {
			obj.gameWindow.remove();
			obj.gameWindow.css({top: "-100%"});
		}, 600, obj);
	}, 10, this);
};
Match.prototype.show = function() {
	if (Match.transitioning || Match.current == this) {
		return;
	}
	Match.transitioning = true;

	if (Match.current) {
		Match.current.hide();
	}
	Match.old = Match.current;
	Match.current = this;
	this.getListItem().addClass("selectedgame");

	$('#rightpane').append(this.gameWindow);
	setTimeout(function(obj) {
		obj.gameWindow.css({top: "0%"});
		setTimeout(function() {
			Match.transitioning = false;
		}, 600);
	}, 10, this);
};
Match.prototype.updateAlpha = function(off) {
	this.obj.alpha ^= (1 << off);

	if ((this.alphaStatus & 1) == 0) {
		this.alphaStatus |= 1;
		this.request(this, "updateAlpha", [this.obj.alpha], this.alphaDone, this.alphaFail);
	} else {
		this.alphaStatus |= 2;
	}
};
Match.prototype.sortTurns = function() {
	this.turnDiv.children('div').sort(function(ao, bo) {
		return ao.id - bo.id;
	}).detach().appendTo(this.turnDiv);
};
Match.prototype.alphaFail = function(r, err) {
	this.alphaStatus |= 2;
	this.alphaDone(r, err);
};
Match.prototype.alphaDone = function(r, err) {
	if (err != 0) {
		this.alphaStatus |= 2;
	}

	if ((this.alphaStatus & 2) == 2) {
		this.alphaStatus |= 1;
		this.request(this, "updateAlpha", [this.obj.alpha], this.alphaDone, this.alphaFail);
	} else {
		this.alphaStatus = 0;
	}
};
Match.prototype.updateTurn = function(obj) {
	if (!(obj.turnid in this.turns)) {
		this.turns[obj.turnid] = new Turn(this);
	}
	this.turns[obj.turnid].update(obj);

	if (!this.pivot || obj.turnid > this.pivot) {
		this.pivot = obj.turnid;
	}

	// Update state
	if (obj.guess.length > 0) {
		this.obj.needword = obj.correct == 4;
	}
	if (obj.turnnum > 0 && this.getOpponent().isLoaded()) {
		this.obj.turn = obj.playerid == this.getOpponent().getId();
	}
};
Match.prototype.turnResult = function(res, err) {
	for (x in res) {
		this.updateTurn(res[x]);
	}
	if (res.length == Match.TURNS_PER_REQUEST) {
		this.getMoreTurns(0, 0);
	}
};
Match.prototype.playWord = function(word) {
	this.request(this, this.needsWord() ? "setWord" : "takeTurn", [word], this.getMoreTurns);
};
Match.prototype.request = function() {
	arguments[2].unshift(this.getId());
	API.request.apply(this, arguments);
};
Match.prototype.revoke = function() {
	for (x in this.turns) {
		this.pivot = x - 1;
		return;
	}
};
Match.TURNS_PER_REQUEST = 10;
Match.matches = {};
Match.transitioning = false;
Match.update = function(obj) {
	if (!Match.matches[obj.gameid]) {
		Match.matches[obj.gameid] = new Match();
	}
	return Match.matches[obj.gameid].update(obj);
};
Match.updateAll = function() {
	for (x in Match.matches) {
		Match.matches[x].updateDOM();
	}
};
Match.sort = function() {
	var games = $('#gamelist > div');

	games.children('div').sort(function(ao, bo) {
		a = Match.matches[ao.id];
		b = Match.matches[bo.id];

		var r = (b.isTurn() ? 1 : 0) - (a.isTurn() ? 1 : 0);

		return r != 0 ? r : (b.obj.updated - a.obj.updated) * (a.isTurn() ? -1 : 1);
	}).detach().appendTo(games);
};
Match.result = function(res, err) {
	$('#refresh').removeClass('spinner');
	if (err == 0) {
		for (x in res) {
			Match.update(res[x]);
		}
		Match.sort();
	} else {
		Match.current.showError(Error.SERVER);
	}
	setTimeout(function() { if (Match.current === undefined) { $('#gamelist .game').first().click(); } }, 1000);
};
Match.loadGames = function() {
	if (!$('#refresh').hasClass('spinner')) {
		$('#refresh').addClass('spinner');
		API.request(this, "getMatches", [], Match.result);
	}
};
Match.revoke = function() {
	for (x in Match.matches) {
		Match.matches[x].revoke();
	}
};

// -------------------------------------------------------------------- //

var Turn = function(match) {
	this.match = match;
	this.timeDiv = $("<div/>", {class: "time"});
	this.pegsDiv = $("<div/>", {class: "pegs"});
	this.textDiv = $("<span/>");

	this.turnDiv = $("<div/>")
		.append(this.pegsDiv)
		.append(this.timeDiv)
		.append(this.textDiv);
};
Turn.prototype.isPlayer = function() {
	return User.me.isLoaded() && User.me.getId() == this.obj.playerid;
};
Turn.prototype.update = function(obj) {
	this.obj = obj;

	this.updateDOM();
};
Turn.prototype.getElement = function() {
	this.updateDOM();
	return this.turnDiv;
};
Turn.prototype.updateDOM = function() {
	this.turnDiv.attr("id", this.getId());

	if (this.getTurnNum() > 0 || this.isPlayer()) {
		this.match.turnDiv.append(this.turnDiv);
		this.match.sortTurns();
	} else {
		this.turnDiv.remove();
	}

	if (this.getTurnNum() > 0) {
		this.match.turnCountDiv.show();
	} else {
		this.match.turnCountDiv.hide();
	}
	this.match.turnCountDiv.children().text(this.getTurnNum());

	if (this.obj.turnnum == 0) {
		this.turnDiv.addClass('turn_new');
		this.textDiv.text("Your word is " + this.getGuess());
	} else {
		this.pegsDiv.empty();
		t = -2;

		while (this.getCorrect() - t++ > 2) this.pegsDiv.append($("<div/>", {class: "gold"}));
		while ((this.getDisplaced() + this.getCorrect()) - t++ > 1) this.pegsDiv.append($("<div/>", {class: "silver"}));
		while (t++ < 4) this.pegsDiv.append($("<div/>", {class: "white"}));

		if (this.isPlayer()) {
			this.turnDiv.addClass("turn_player");
		} else {
			this.turnDiv.removeClass("turn_player");
		}
		this.textDiv.html(
			(this.isPlayer() ? this.obj.guess : this.match.getOpponent().getName() + " guessed " +
				this.getGuess() +
				(this.isWin() ? "<br />" + this.match.getOpponent().getName() + "'s word was " + this.obj.oppword : "")
			)
		);

		if (this.isWin()) {
			this.turnDiv.addClass("turn_win");
		} else {
			this.turnDiv.removeClass("turn_win");
		}

		this.timeDiv.text(this.getTimeSince());
	}
};
Turn.prototype.getTimeSince = function() {
	return timeSince(this.obj.when);
};
Turn.prototype.getTurnNum = function() {
	return this.obj.turnnum;
};
Turn.prototype.getId = function() {
	return this.obj.turnid;
};
Turn.prototype.isWin = function() {
	return this.getCorrect() == 4;
};
Turn.prototype.getGuess = function() {
	return this.obj.guess;
};
Turn.prototype.getCorrect = function() {
	return this.obj.correct;
};
Turn.prototype.getDisplaced = function() {
	return this.obj.displaced;
};

// -------------------------------------------------------------------- //

var User = function() {
	this.loaded = false;
};
User.prototype.update = function(obj) {
	this.obj = obj;
	this.loaded = true;
	return this;
};
User.prototype.getImage = function() {
	return this.obj.image.url;
};
User.prototype.getName = function(long) {
	return this.isLoaded() ? (long ? this.obj.displayName : this.obj.name.givenName) : "";
};
User.prototype.getId = function() {
	return this.obj.id;
};
User.prototype.isLoaded = function() {
	return this.loaded;
};
User.users = {};
User.me = new User();
User.get = function(id) {
	if (!User.users[id]) {
		User.users[id] = new User();
		gapi.client.request({path: "/plus/v1/people/" + id, callback: User.result});
	}
	return User.users[id];
};
User.result = function(usr) {
	user = User.users[usr.id].update(usr);
	Match.updateAll();
};
User.meresult = function(usr) {
	user = new User();
	User.me = User.users[usr.id] = user.update(usr);
	Match.updateAll();
};
User.revoke = function() {
	User.me = new User();	
};

// -------------------------------------------------------------------- //

var API = function() {};
API.baseURL = "https://thomasc.co.uk/wm/";
API.identified = false;
API.token = "";
API.request = function(scope, endpoint, params, func, fail) {
	if (!API.identified) { console.log("NOT IDENTIFIED"); return; };

	params.unshift(API.playerid);
	API._request(scope, endpoint, params, func, fail);
};
API.identify = function(token) {
	API.token = token;
	API._request(this, "identify", [token], API.result);
};
API._request = function(scope, endpoint, params, func, fail) {
	url = API.baseURL + endpoint + "/" + params.join("/");
	API.internal(scope, url, func, fail);
};
API.internal = function(scope, url, func, fail) {
	$.getJSON(url, function(data) {
		if (func !== undefined) {
			func.apply(scope, [data['response'], data['error']]);
		}
	}).fail(function() {
		if (Match.current) {
			Match.current.showError(Error.NETWORK);
		}
		fail.apply(scope);
	});
};
API.result = function(res, err) {
	if (err == 0) {
		API.playerid = res['key'];
		API.identified = true;

		$('#overlay').hide();
		Match.loadGames();
	} else {
		console.log("Error Connecting to Game Server");
		console.log(err);
	}
};
API.revoke = function(func) {
	API.identified = false;
	$.ajax({
		url: "https://accounts.google.com/o/oauth2/revoke?token=" + API.token,
		contentType: "application/json",
		dataType: 'jsonp',
		success: func
	});
};

// -------------------------------------------------------------------- //

function signinCallback(authResult) {
	if (authResult['access_token']) {
		API.identify(authResult['access_token']);
		gapi.client.request({path: "/plus/v1/people/me", callback: User.meresult});

		$('#refresh').click(function() { Match.loadGames(); });
		$('#menu_ach').click(function() {
			gapi.client.request({path: "/games/v1/players/me/achievements", callback: Achievement.result});
			gapi.client.request({path: "/games/v1/achievements", callback: Achievement.result});
		});
		$('#menu_log').click(function() {
			API.revoke(function() {
				User.revoke();
				Match.revoke();

				$('#overlay').show();
				Match.current.hide();
				delete Match.current;
				$('#gamelist > div > div').remove();
			});
		});
		$('#ach_header').click(function() {
			$('#achievements').hide();
		});
	}
}

var word = "";

$(document).keydown(function(e) {
	c = e.keyCode;
	if (c >= 65 && c <= 90 && word.length < 4) {
		word += String.fromCharCode(c);
	} else if (c == 8) {
		word = word.substr(0, word.length - 1);
	} else if (c == 13) {
		Match.current.playWord(word);
		word = "";
	} else {
		return;
	}
	e.preventDefault();

	for (i = 0; i < 4; i++) {
		Match.current.guessDiv[i].text(word.substr(i, 1));
		Match.current.guessDiv[i].attr("class", i < word.length ? "char" : "");
	}
});

function timeSince(time) {
	diff = (new Date().getTime() / 1000) - time;
	if (d(diff, 60) == 0) {
		return d(diff, 1) + "s";
	} else if (d(diff, 3600) == 0) {
		return d(diff, 60) + "m";
	} else if (d(diff, 86400) == 0) {
		return d(diff, 3600) + "h";
	} else {
		return d(diff, 86400) + "d";
	}
}

function d(a, b) {
	return Math.floor(a / b);
}
