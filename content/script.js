var Achievement = function() {
	Achievement.listElement.append(this.element = $('<div/>', {class: "achievement"})
		.append($('<span/>', {class: "text"})
			.append(this.nameDiv = $('<h2/>'))
			.append(this.descDiv = $('<span/>'))
		)
	);
	this.infoDiv = $('<span/>', {class: "progress"})
		.append(this.infoTextDiv = $('<span/>', {class: "text"}))
		.append(this.infoDispDiv = $('<span/>'));
	this.imgDiv = $('<img/>');
	this.lockDiv = $('<span/>', {class: "unlocked"});
	this.circleDiv = $('<span/>', {class: "circle"});
};
Achievement.prototype.collect = function(obj) {
	for (p in obj) {
		if (obj.hasOwnProperty(p)) {
			this[p] = obj[p];
		}
	}
	this.updateDOM();
};
Achievement.prototype.updateDOM = function() {
	this.descDiv.text(this.getDescription());
	this.nameDiv.text(this.getName());

	if (this.getState() == "UNLOCKED") {
		this.element.prepend(this.lockDiv.addClass("unlocked"));
	} else {
		this.lockDiv.remove();
	}

	if (this.getType() == "INCREMENTAL") {
		this.imgDiv.remove();
		this.element.prepend(this.infoDiv);
		this.infoTextDiv.text(this.getProgress(100) + "%");
		this.infoDispDiv.attr('class', this.getProgress(2) > 0 ? "circle" : "progress_half");
		this.circleDiv.css({transform: "rotate(" + this.getProgress(360) + "deg)"});

		if (this.getProgress(2) > 0) {
			this.infoDiv.append(this.circleDiv);
		} else {
			this.infoDispDiv.append(this.circleDiv);
		}
	} else {
		this.infoDiv.remove();
		this.element.prepend(this.imgDiv.attr({src: this.getIconUrl()}));
	}
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
Achievement.getUnlockedCount = function() {
	var unlocked = 0;
	for (x in Achievement.achievements) {
		unlocked += Achievement.achievements[x].getState() == "UNLOCKED" ? 1 : 0;
	}
	return unlocked;
};
Achievement.element = $('<div/>', {id: "achievements"})
		.append($('<h1/>', {text: "Achievements"})
			.append(Achievement.closeElement = $('<span/>'))
		)
		.append(Achievement.listElement = $('<div/>')
			.append(Achievement.progressDiv = $('<h3/>')
				.append(Achievement.progressBarDiv = $('<span/>')
					.append(Achievement.barTextDiv = $('<b/>'))
					.append(Achievement.barDiv = $('<span/>'))
				)
			)
		);
Achievement.update = function(obj) {
	if (!Achievement.achievements[obj.id]) {
		Achievement.achievements[obj.id] = new Achievement();
	}
	Achievement.achievements[obj.id].collect(obj);
};
Achievement.count = function() {
	return Object.keys(Achievement.achievements).length;
};
Achievement.show = function() {
	Achievement.progressDiv.text(Achievement.getUnlockedCount() + '/' + Achievement.count() + ' unlocked').append(Achievement.progressBarDiv);
	Achievement.barTextDiv.text(d(Achievement.getUnlockedCount() * 100, Achievement.count()) + '%');
	Achievement.barDiv.css({width: d(Achievement.getUnlockedCount() * 90, Achievement.count())});

	$(document.body).append(Achievement.element);
	Achievement.closeElement.click(function() { Achievement.hide(); });

	$('#ach_header span').click(function() {
		Achievement.hide();
	});
};
Achievement.hide = function() {
	Achievement.element.remove();
};
Achievement.result = function(ach) {
	if (ach.error) {
		User.logout();
		return;
	}

	for (x in ach.items) {
		Achievement.update(ach.items[x]);
	}

	Achievement.show();
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
	} else if (this.visible) {
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
Error.global = new Error();
Error.global.errorDiv.insertAfter('#header');
Error.NETWORK		= {name: "Network Unavailable", desc: "Please check your data connection"};
Error.TURN		= {name: "It's not your turn!", desc: "Wait for your opponent to take their turn."};
Error.WORD		= {name: "Not a word", desc: "That word is not in the Wordmaster dictionary."};
Error.SERVER		= {name: "Server Error", desc: "Something went wrong. Try again later."};
Error.OPPONENT	= {name: "Game not ready", desc: "Opponent hasn't chosen their word yet."};
Error.MATCH		= {name: "Match already exists", desc: "You're already playing against that person."};
Error.WORDSET		= {name: "Word already set", desc: "You've already chosen your word for this game."};
Error.AUTOMATCH	= {name: "Auto match pending", desc: "You're already in the queue for matching."};

// -------------------------------------------------------------------- //

var Match = function() {
	this.word = "";
	this.turns = [];
	this.error = new Error();

	var keyboard = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
	var offset = 0;
	this.alpha = [];
	this.alphaDiv = $("<div/>", {class: "alpha"});

	for (x in keyboard) {
		var row = $("<div/>");
		for (i = 0; i < keyboard[x].length; i++) {
			row.append(this.alpha[offset] = $("<span/>", {id: "alpha_" + offset++, text: keyboard[x].substr(i, 1)}));
		}
		this.alphaDiv.append(row);
	}

	this.gameWindow = $('<div/>', {class: "gameWindow"})
	.append($('<div/>', {class: "scores"})
		.append(this.meScoreDiv = $('<div/>', {text: "0"}))
		.append(this.oppScoreDiv = $('<div/>', {text: "0"}))
	)
	.append(this.error.getElement())
	.append(this.scrollDiv = $('<div/>', {class: "turns"})
		.append(this.turnDiv = $('<div/>'))
	)
	.append(this.alphaDiv)
	.append(this.footerDiv = $('<div/>', {class: "footer"})
		.append(this.turnCountDiv = $('<div/>', {class: "turn_count", text: "Turn"})
			.append($('<span/>', {text: "2"}))
		)
		.append(this.guessButton = $('<img/>', {src: "image/guess_disabled.png"}))
		.append($('<div/>', {class: "guess"})
			.append(this.guessDiv = [$('<div/>'), $('<div/>'), $('<div/>'), $('<div/>')])
		)
	);

	this.timeDiv = $('<div/>', {class: "time"});
	this.noteDiv = $('<div/>', {class: "note"});
	this.oppImg = $('<img/>');
	this.textDiv = $('<b/>');

	this.listItem = $('<div/>', {class: "game"})
	.append(this.oppImg)
	.append($('<span/>', {text: "vs "}).append(this.textDiv))
	.append(this.timeDiv);
};
Match.prototype.keydown = function(e) {
	c = e.keyCode;
	if (c >= 65 && c <= 90 && this.word.length < 4) {
		this.word += String.fromCharCode(c);
	} else if (c == 8) {
		this.word = this.word.substr(0, this.word.length - 1);
	} else if (c == 13 && this.word.length == 4) {
		this.playWord();
	} else if (c == 27) {
		this.hide();
	} else {
		return;
	}
	e.preventDefault();
	this.updateDOM();
};
Match.prototype.scroll = function(event) {
	if (this.scrollDiv.scrollTop() < 12 && this.lastpivot) {
		this.request(this, "getTurns", [this.lastpivot, -Match.TURNS_PER_REQUEST], this.scrollResult);
	}
};
Match.prototype.timer = function() {
	this.updateDOM();
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
	if (this.obj.oppid !== undefined) {
		return User.get(this.obj.oppid);
	} else {
		return User.autoMatch;
	}
};
Match.prototype.getTimeSince = function() {
	return timeSince(this.obj.updated);
};
Match.prototype.isTurn = function() {
	return this.obj.turn || this.needsWord();
};
Match.prototype.needsWord = function(o) {
	if (typeof o == "boolean") {
		this.obj.needword = o;
		this.updateDOM();
	}
	return this.obj.needword;
};
Match.prototype.update = function(obj) {
	update = this.obj ? (this.obj.updated < obj.updated) : true;
	this.obj = obj;

	Match.updatePoint = Math.max(Match.updatePoint, this.obj.updated);

	Match.listElement.append(
		this.getListItem()
		.click($.proxy(function() { this.show(); }, this))
	);

	if (update) {
		this.getMoreTurns(0, 0);
	}
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
			this.updateDOM();
			break;
		case 6:
			this.showError(Error.WORDSET);
			this.needsWord(false);
			this.updateDOM();
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
		this.textDiv.text(this.getOpponent().getName(true));

		if (this.getOpponent().getId().length == 0) {
			this.getListItem().addClass("automatch");
		} else {
			this.getListItem().removeClass("automatch");
		}
	}

	this.meScoreDiv.text(this.obj.pscore);
	this.oppScoreDiv.text(this.obj.oscore);

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

	if (this.needsWord() && this.word.length == 0) {
		this.footerDiv.addClass("needsword");
	} else {
		this.footerDiv.removeClass("needsword");
	}

	this.guessButton.attr({src: "image/guess" + (this.word.length == 4 ? "" : "_disabled") + ".png"});

	for (i = 0; i < 4; i++) {
		this.guessDiv[i].text(this.word.substr(i, 1));
		this.guessDiv[i].attr("class", i < this.word.length ? "char" : "");
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
	Match.sort();
};
Match.prototype.hide = function() {
	this.getListItem().removeClass("selectedgame");
	clearInterval(this.interval);

	setTimeout(function(obj) {
		obj.gameWindow.removeClass("main").addClass("end");
		if (Match.current == obj) {
			delete Match.current;
			$(document.body).removeClass("showgame");
			$('#android-helper').blur();
			document.location.hash = "";
		}
		setTimeout(function(obj) {
			obj.gameWindow.removeClass("end").removeClass("trans").remove();
		}, 600, obj);
	}, 10, this);
};
Match.prototype.show = function() {
	// Don't show if we're already changing match, this is the current match, or this match isn't visible to the user
	if (Match.transitioning || Match.current == this || !$.contains(document, this.getListItem()[0])) {
		return;
	}
	Create.hide();
	document.location.hash = this.getId();
	Match.transitioning = true;

	if (Match.current) {
		this.gameWindow.addClass("trans");
		Match.current.hide();
	}
	Match.old = Match.current;
	Match.current = this;
	this.getListItem().addClass("selectedgame");
	this.interval = setInterval($.proxy(this.timer, this), 1000);

	if (Scale.isAndroid()) {
		$('#android-helper').click();
	}

	$(Match.paneDiv).append(this.gameWindow);

	for (i in this.alpha) {
		this.alpha[i].click({obj: this}, function(event) { $(this).toggleClass('hidden'); event.data.obj.updateAlpha(this.id.substr(6)); });
	}
	this.scrollDiv.scroll($.proxy(this.scroll, this));
	this.guessButton.click($.proxy(function() { this.playWord(); }, this));

	setTimeout(function(obj) {
		$(document.body).addClass("showgame");
		obj.gameWindow.addClass("main");
		obj.scrollToBottom();
		setTimeout(function() {
			obj.scrollToBottom();
			Match.transitioning = false;
		}, 600);
	}, 10, this);
};
Match.prototype.scrollToBottom = function() {
	if (this.turns[this.pivot]) {
		this.scrollDiv.scrollTo(this.turns[this.pivot].getElement());
	}
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
	// Request done, remove status flag
	this.alphaStatus &= ~1;
	if (err != 0) {
		this.alphaStatus |= 2;
	}

	if ((this.alphaStatus & 2) == 2) {
		this.alphaStatus |= 1;
		this.request(this, "updateAlpha", [this.obj.alpha], this.alphaDone, this.alphaFail);
	}
	this.alphaStatus &= ~2;
};
Match.prototype.updateTurn = function(obj) {
	if (!(obj.turnid in this.turns)) {
		this.turns[obj.turnid] = new Turn(this);
	}
	this.turns[obj.turnid].update(obj);

	if (this.lastpivot === undefined || obj.turnid < this.lastpivot) {
		if (obj.turnid == 0) {
			this.turnDiv.css({marginTop: 0});
		} else {
			this.turnDiv.css({marginTop: "12px"});
		}
		this.lastpivot = obj.turnid;
	}
	if (this.pivot === undefined || obj.turnid > this.pivot) {
		this.pivot = obj.turnid;

		// Update state
		if (obj.guess.length > 0) {
			this.needsWord(obj.correct == 4);
		}
		if (obj.turnnum > 0 && this.getOpponent().isLoaded()) {
			this.obj.turn = obj.playerid == this.getOpponent().getId();
		}

		if (obj.turnnum > 0 && obj.correct < 4) {
			this.turnCountDiv.show();
		} else {
			this.turnCountDiv.hide();
		}
		this.turnCountDiv.children().text(obj.turnnum);
		this.scrollToBottom();

		this.updateDOM();
	}
};
Match.prototype.scrollResult = function(res, err) {
	topElement = this.turns[this.lastpivot];
	for (x in res) {
		this.updateTurn(res[x]);
	}
	this.scrollDiv.scrollTo(topElement.getElement());
};
Match.prototype.turnResult = function(res, err) {
	for (x in res) {
		this.updateTurn(res[x]);
	}
	if (res.length == Match.TURNS_PER_REQUEST) {
		this.getMoreTurns(0, 0);
	}
};
Match.prototype.playWord = function() {
	if (this.word.length == 4) {
		this.request(this, this.needsWord() ? "setWord" : "takeTurn", [this.word]);
		this.word = "";
		this.guessButton.attr({src: "image/guess_disabled.png"});
	}
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
Match.updatePoint = 0;
$('#leftpane').append($('<div/>', {class: "gamelist"}).append(Match.listElement = $('<div/>')));
Match.TURNS_PER_REQUEST = 10;
Match.matches = {};
Match.transitioning = false;
Match.paneDiv = $('<div/>', {id: "rightpane"});
$(document.body).append(Match.paneDiv);
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
	Match.listElement.children('div').sort(function(ao, bo) {
		a = Match.matches[ao.id];
		b = Match.matches[bo.id];

		var r = (b.isTurn() ? 1 : 0) - (a.isTurn() ? 1 : 0);

		return r != 0 ? r : (b.obj.updated - a.obj.updated) * (a.isTurn() ? -1 : 1);
	}).detach().appendTo(Match.listElement);
};
Match.result = function(res, err) {
	if (err == 0) {
		for (x in res) {
			Match.update(res[x]);
		}
	} else {
		Match.current.showError(Error.SERVER);
	}
	setTimeout(function() {
		$('#refresh').removeClass('spinner');
		if (window.location.hash.length == 0 && !Scale.isAndroid() && Match.current === undefined && !Scale.isSmall()) {
			$('.game').first().click();
		} else {
			window.onhashchange();
		}
	}, 200);
};
Match.fail = function() {
	$('#refresh').removeClass('spinner');
};
Match.loadGames = function() {
	if (!$('#refresh').hasClass('spinner')) {
		$('#refresh').addClass('spinner');
		API.request(this, "getMatches", [], Match.result, Match.fail);
	}
};
Match.longPoll = function() {
	API.request(this, "longPoll", [Match.updatePoint], function(r, e) {
		if (e == 0) {
			Match.result(r, 0);
		}
		Match.longPoll();
	}, function() {
		Match.longPoll();
	});
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

	this.turnDiv = $("<div/>", {class: "turn"})
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

	if (this.obj.turnnum == 0) {
		this.turnDiv.addClass('turn_new');
		this.textDiv.text("Your word is " + this.getGuess());
		this.pegsDiv.remove();
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
	}
	this.timeDiv.text(this.getTimeSince());
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
User.autoMatch = new User().update({displayName: "Auto Match In Progress", name: {givenName: "Auto Match"}, id: "", image: {url: "image/games_matches_green.png"}});
User.get = function(id) {
	if (!User.users[id]) {
		User.users[id] = new User();
		gapi.client.request({path: "/plus/v1/people/" + id, callback: User.result});
	}
	return User.users[id];
};
User.result = function(usr) {
	if (usr.error) {
		User.logout();
		return;
	}

	user = User.users[usr.id].update(usr);
	Match.updateAll();
};
User.meresult = function(usr) {
	if (usr.error) {
		User.logout();
		return;
	}

	user = new User();
	User.me = User.users[usr.id] = user.update(usr);
	Match.updateAll();
};
User.logout = function() {
	API.revoke(function() {
		User.me = new User();
		Match.revoke();

		$('#signin').show();
		if (Match.current) {
			Match.current.hide();
			delete Match.current;
		}
		Match.listElement.children('div').remove();
	});
};

// -------------------------------------------------------------------- //

var API = function() {};
API.baseURL = "https://thomasc.co.uk/wm/";
API.identified = false;
API.token = "";
API.request = function(scope, endpoint, params, func, fail) {
	if (!API.identified) { console.log("NOT IDENTIFIED"); if (typeof fail == "function") { fail.apply(scope); } return; };

	params.unshift(API.playerid);
	API._request(scope, endpoint, params, func, fail);
};
API.identify = function(token) {
	API.token = token;
	API._request(this, "identify", [API.token.B.access_token], API.result);
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
		if (typeof fail == "function") {
			fail.apply(scope);
		}
	});
};
API.result = function(res, err) {
	if (err == 0) {
		API.playerid = res['key'];
		API.identified = true;

		Match.loadGames();
		Match.longPoll();
	} else {
		console.log("Error Connecting to Game Server");
		console.log(err);
	}
};
API.revoke = function(func) {
	if (API.identified) {
		API.identified = false;
		API.token.disconnect();
		func();
	} else {
		func();
	}
};

// -------------------------------------------------------------------- //

var Create = function() {
	this.element = $('<div/>', {class: "player"});
	this.imgDiv = $('<img/>');
};
Create.prototype.update = function(obj) {
	this.obj = obj;

	Create.playersDiv.append(this.element);
	this.updateDOM();

	return this;
};
Create.prototype.updateDOM = function(obj) {
	this.element.text(this.obj.displayName);
	this.element.prepend(this.imgDiv.attr({src: this.obj.image.url + "&sz=70"}));
	this.element.off('click').click($.proxy(function() {
		API.request(this, "createGame", [this.obj.id], Create.createResult);
		Create.hide();
	}, this));
};
Create.show = function(obj) {
	Create.hide();
	if (obj) {
		$(document.body).append(Create.upgradeDiv);
		Create.upgradeCloseDiv.click(Create.hide);

		Create.dialogText.html(obj.text);

		Create.dialogButtonA.html(obj.buttonA.text);
		Create.dialogButtonA.click(obj.buttonA.link);

		Create.dialogButtonB.html(obj.buttonB.text);
		Create.dialogButtonB.click(obj.buttonB.link);
	} else {
		$(document.body).append(Create.element);
		for (x in Create.opponents) {
			Create.opponents[x].updateDOM();
		}
		Create.playersDiv.scroll(Create.checkScroll);
		Create.closeDiv.click(Create.hide);
		Create.checkScroll();
	}
};
Create.hide = function() {
	Create.element.remove();
	Create.upgradeDiv.remove();
};
Create.checkScroll = function() {
	if (Create.moreToken) {
		fromBottom = 0;
		if (Create.playersDiv.children().length > 0) {
			lastElem = Create.playersDiv.children().last();
			fromBottom = ($(lastElem).offset().top + $(lastElem).height()) - ($(Create.playersDiv).offset().top + $(Create.playersDiv).height());
		}
		if (fromBottom < 10) {
			Create.getMore();
		}
	}
};
Create.getMore = function() {
	parm = {orderBy: "best", maxResults: Create.PEOPLE_PER_REQUEST};
	if (Create.moreToken) {
		parm.pageToken = Create.moreToken;
		delete Create.moreToken;
	} else {
		for (x in Create.opponents) {
			if (x.length > 0) {
				Create.opponents[x].element.remove();
			}
		}
	}
	gapi.client.request({path: "/plus/v1/people/me/people/visible", params: parm, callback: Create.result});
};
Create.result = function(obj) {
	if (obj.error) {
		User.logout();
		return;
	}

	if (obj.nextPageToken) {
		Create.moreToken = obj.nextPageToken;
	}

	var opponents = [];
	Match.listElement.children().each(function() {
		opponents.push(Match.matches[this.id].getOpponent().getId());
	});
	for (x in obj.items) {
		if (opponents.indexOf(obj.items[x].id) < 0) {
			if (!(obj.items[x].id in Create.opponents)) {
				Create.opponents[obj.items[x].id] = new Create();
			}
			Create.opponents[obj.items[x].id].update(obj.items[x]);
		}
	}
	Create.show();
};
Create.createResult = function(r, e) {
	if (e != 0) {
		if (e == 4) {
			Create.show(Create.UPGRADE);
		} else if (e == 5) {
			Error.global.show(Error.MATCH);
		} else if (e == 9) {
			Error.global.show(Error.AUTOMATCH);
		} else {
			Error.global.show(Error.SERVER);
		}
		return;
	}
	document.location.hash = r.gameid;
};
Create.paypal = function() {
	paypal.checkout.initXO();

	API.request(this, "cartToken", [],
		function(data) {
			paypal.checkout.startFlow(data.token);
		},
		function() {
			paypal.checkout.closeFlow();
		}
	);
};
Create.completePaypal = function() {
	q = parseQuery(newHash.substr(15));
	API._request(this, "cartState", [q.token, q.PayerID], function(r) {
		Create.hide();
		Create.getMore();
	}, function() {
		Error.global.show(Error.SERVER);
	});
};
Create.PEOPLE_PER_REQUEST = 100;
Create.element = $('<div/>', {class: "overlay"})
	.append($('<div/>')
		.append(Create.closeDiv = $('<img/>', {src: "image/navigation_cancel.png"}))
		.append($('<h1/>', {text: "Create Game"}))
		.append(Create.playersDiv = $('<div/>', {class: "players"}))
	);
Create.upgradeDiv = $('<div/>', {class: "upgrade"})
	.append($('<div/>')
		.append(Create.upgradeCloseDiv = $('<img/>', {src: "image/navigation_cancel.png"}))
		.append($('<h1/>', {text: "Upgrade"}))
		.append($('<div/>')
			.append(Create.dialogText = $('<span/>'))
			.append(Create.dialogButtonA = $('<div/>', {class: "button"}))
			.append(Create.dialogButtonB = $('<div/>', {class: "button"}))
		)
	);
Create.UPGRADE = {
	text: "To create more games you need to upgrade to the full version of Wordmaster.<br /><br />This one-off payment will allow you to create as many games as you like.",
	buttonA: {
		text: "<img src=\"https://www.paypalobjects.com/webstatic/en_US/i/buttons/pp-acceptance-small.png\" alt=\"Buy now with PayPal\" />Upgrade - &pound;0.99",
		link: Create.paypal
	},
	buttonB: {
		text: "No Thanks",
		link: Create.hide
	}
};
Create.CONFIRM = {
	text: "You're nearly there!<br /><br />To pay &pound;0.99 and complete your upgrade click the button below.",
	buttonA: {
		text: "Complete Payment",
		link: Create.completePaypal
	},
	buttonB: {
		text: "Cancel",
		link: Create.hide
	}
};
Create.opponents = {"": new Create().update({id: "", displayName: "Auto Match", image: {url: "ximage/games_matches_green.png?"}})};


// -------------------------------------------------------------------- //

var Scale = function() {};
Scale.isSmall = function() {
	return $('#leftpane').css('border-right-width') == "0px";
};
Scale.isAndroid = function() {
	return navigator.userAgent.toLowerCase().indexOf("android") > -1;
};
Scale.keyboardClosed = function() {
	return ($(window).height() / screen.height) > 0.7;
};

// -------------------------------------------------------------------- //

function signinCallback(authResult) {
	$('#signin').hide();
	API.identify(authResult);
	gapi.client.request({path: "/plus/v1/people/me", callback: User.meresult});
}

function onSignInFailure(a) {
	console.log(a);
}

function urlencode(v) {
	return encodeURIComponent(encodeURIComponent(v));
}

function parseQuery(qstr) {
	var query = {};
	var a = qstr.split('&');
	for (var i = 0; i < a.length; i++) {
		var b = a[i].split('=');
		query[decodeURIComponent(b[0])] = decodeURIComponent(b[1]);
	}
	return query;
}

window.onhashchange = function(event) {
	if (window.location.hash.length > 0) {
		newHash = window.location.hash.substr(1);
		if (newHash.substr(0, 14) == "paypal-success") {
			Create.show(Create.CONFIRM);
			$('#PPFrame').remove();
		} else if (!Scale.isAndroid()) {
			match = Match.matches[newHash];
			if (match) {
				match.show();
			}
		}
	} else if (Match.current) {
		Match.current.hide();
	}
}

$(document).keydown(function(e) {
	if (Match.current) {
		Match.current.keydown(e);
	}
});

$(window).resize(function(e) {
	if (Scale.isAndroid() && Scale.keyboardClosed() && Match.current) {
		Match.current.hide();
	}
});

$(document).ready(function() {
	$('#android-helper').click(function(e) { $(this).focus(); });

	$('#refresh').click(Match.loadGames);
	$('#menu_ach').click(function() {
		gapi.client.request({path: "/games/v1/players/me/achievements", callback: Achievement.result});
		gapi.client.request({path: "/games/v1/achievements", callback: Achievement.result});
	});
	$('#menu_log').click(User.logout);
	$('#menu_new').click(Create.getMore);
	window.onhashchange();
});

function timeSince(time) {
	diff = (new Date().getTime() - time) / 1000;
	if (diff < 0) {
		return "~0s";
	} else if (d(diff, 60) == 0) {
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

$.fn.scrollTo = function(target, options) {
	var settings = $.extend({
		scrollTarget	: target,
		offsetTop	: 0
	}, options);
	return this.each(function() {
		var scrollPane = $(this);
		var scrollTarget = (typeof settings.scrollTarget == "number") ? settings.scrollTarget : $(settings.scrollTarget);
		var scrollY = (typeof scrollTarget == "number") ? scrollTarget : scrollTarget.offset().top - scrollPane.offset().top + scrollPane.scrollTop() - parseInt(settings.offsetTop);
		scrollPane.scrollTop(scrollY);
	});
};
