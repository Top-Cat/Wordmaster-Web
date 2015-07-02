var Achievement = function(obj) {
	this.collect(obj);
};
Achievement.prototype.collect = function(obj) {
	for (p in obj) {
		if (obj.hasOwnProperty(p)) {
			this[p] = obj[p];
		}
	}
};
Achievement.prototype.getElement = function() {
	achElem = $('<div/>', {text: this.getDescription()});
	achElem.prepend($('<h1/>', {text: this.getName()}));
	if (this.getAchievementState() == "UNLOCKED") {
		unlocked++;
		achElem.prepend($('<span/>', {class: "unlocked"}));
	}
	if (this.achievementType == "INCREMENTAL" && this.getAchievementState() == "REVEALED") {
		progress = $('<span/>', {class: "progress"})
			.append(
			$('<span/>',
				{
					class: "text",
					text: this.getProgress(100) + '%'
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
		achElem.prepend($('<img/>', {src: (this.getAchievementState() == "UNLOCKED" ? this.unlockedIconUrl : this.getRevealedIconUrl())}));
	}
	return achElem;
};
Achievement.prototype.getProgress = function(a) {
	a = typeof a !== 'undefined' ? a : 1;
	return d((this.currentSteps ? this.currentSteps : 0) * a, this.totalSteps);
};
Achievement.prototype.getRevealedIconUrl = function() {
	return this.achievementState == "HIDDEN" ? "image/lock.png" : this.revealedIconUrl;
};
Achievement.prototype.getName = function() {
	return this.achievementState == "HIDDEN" ? "Secret" : this.name;
};
Achievement.prototype.getDescription = function() {
	return this.achievementState == "HIDDEN" ? "Keep playing to learn more" : this.description;
};
Achievement.prototype.getAchievementState = function() {
	return this.achievementState == "HIDDEN" ? "REVEALED" : this.achievementState;
};
Achievement.achievements = {};
Achievement.update = function(obj) {
	if (Achievement.achievements[obj.id]) {
		Achievement.achievements[obj.id].collect(obj);
	} else {
		Achievement.achievements[obj.id] = new Achievement(obj);
	}
};
Achievement.count = function() {
	return Object.keys(Achievement.achievements).length;
};

// -------------------------------------------------------------------- //

var Match = function(obj) {
	this.turns = [];
	this.turnDiv = $("<div/>", {id: "turns"});
	this.guessDiv = [$("<div/>"), $("<div/>"), $("<div/>"), $("<div/>")];

	this.gameWindow = $("<div/>", {class: "gameWindow"})
	.append($("<div/>", {id: "scores"})
		.append($("<div/>", {id: "me", text: "0"}))
		.append($("<div/>", {id: "opp", text: "0"}))
	)
	.append(this.turnDiv)
	.append(alpha)
	.append($("<div/>", {id: "footer"})
		.append($("<div/>", {id: "turn_count", text: "Turn"})
			.append($("<span/>", {text: "2"}))
		)
		.append($("<div/>", {id: "guess"})
			.append(this.guessDiv)
		)
	);

	this.timeDiv = $("<div/>", {class: "time"});
	this.noteDiv = $("<div/>", {class: "note"});

	var matchObj = this;

	this.listItem = $("<div/>", {class: "game", id: obj.gameid, text: "vs"})
	.click(function() { matchObj.show(); })
	.append(this.timeDiv);

	$('#gamelist > :first-child').append(this.getListItem());

	this.update(obj);
};
Match.prototype.getListItem = function() {
	return this.listItem;
};
Match.prototype.update = function(obj) {
	this.obj = obj;

	this.updateDOM();
};
Match.prototype.updateDOM = function() {
	if (this.obj.oppid in users && !this.hasOwnProperty('oppImg')) {
		usr = users[this.obj.oppid];
		this.oppImg = $("<img/>", {src: usr['image']['url']});
		setTextContents(this.getListItem(), "vs " + usr['displayName']);
		this.getListItem().prepend(this.oppImg);
	} else if (!(this.obj.oppid in users)) {
		gapi.client.request({path: "/plus/v1/people/" + this.obj.oppid, callback: userResult});
	}

	this.timeDiv.text(timeSince(this.obj.updated));

	if (this.obj.turn || this.obj.neesword) {
		this.getListItem().append(this.noteDiv);
	}
};
Match.prototype.show = function() {
	if (Match.transitioning) {
		return;
	}
	Match.transitioning = true;

	if (Match.current) {
		Match.current.getListItem().removeClass("selectedgame");
	}
	Match.old = Match.current;
	Match.current = this;
	this.getListItem().addClass("selectedgame");

	for (i = 0; i < 26; i++) {
		this.gameWindow.find('#alpha_' + i)
		.attr('class', ((this.obj.alpha >> i) & 1) == 1 ? 'hidden' : '');
	}

	$('#rightpane').append(this.gameWindow);
	setTimeout(function() {
		setTimeout(function() {
			Match.transitioning = false;
		}, 600);
		if (Match.old) {
			Match.old.gameWindow.css({top: "100%"});
			setTimeout(function() {
				Match.old.gameWindow.remove();
			}, 600);
		}
		Match.current.gameWindow.css({top: "0%"});
	}, 10);

	if ('me' in users) {
		this.gameWindow.find('#me').css('background-image', "url('" + users['me']['image']['url'] + "')");
	}
	if (this.obj.oppid in users) {
		this.gameWindow.find('#opp').css('background-image', "url('" + users[this.obj.oppid]['image']['url'] + "')");
	}

	for (x in this.turns) {
		this.turns[x] = this.turns[x].clone(true);
		currentScreen.find('#turns').append(this.turns[x]);
		this.turns[x].updateDOM();
	}

	do_req("getTurns/" + playerid + "/" + this.obj.gameid, turnsResult, this);
};
Match.prototype.updateAlpha = function(off) {
	this.obj.alpha ^= (1 << off);

	if ((this.alphaStatus & 1) == 0) {
		this.alphaStatus |= 1;
		do_req("updateAlpha/" + playerid + "/" + this.obj.gameid + "/" + this.obj.alpha, alphaDone, this, alphaFail);
	} else {
		this.alphaStatus |= 2;
	}
}
Match.matches = {};
Match.transitioning = false;
Match.update = function(obj) {
	if (Match.matches[obj.gameid]) {
		Match.matches[obj.gameid].update(obj);
	} else {
		Match.matches[obj.gameid] = new Match(obj);
	}
};
Match.updateAll = function() {
	for (x in Match.matches) {
		Match.matches[x].updateDOM();
	}
};
Match.prototype.updateTurn = function(obj) {
	if (!(obj.turnid in this.turns)) {
		this.turns[obj.turnid] = new Turn(this, obj.turnid);
	}
	this.turns[obj.turnid].update(obj);
};
Match.sort = function() {
	$('#gamelist').sort(function(ao, bo) {
		a = Match.matches[ao.id];
		b = Match.matches[bo.id];

		var ev1 = (a['turn'] ? 1 : 0) | (a['needword'] ? 2 : 0);
		var ev2 = (b['turn'] ? 1 : 0) | (b['needword'] ? 2 : 0);
		var r = ev2 - ev1;
		if (r == 0) {
			return b['updated'] - a['updated'];
		}
		return r;
	});
};

// -------------------------------------------------------------------- //

var Turn = function(match, tid) {
	this.match = match;
	this.timeDiv = $("<div/>", {class: "time"});
	this.pegsDiv = $("<div/>", {class: "pegs"});
	this.textDiv = $("<span/>");

	this.turnDiv = $("<div/>", {id: tid})
		.append(this.pegsDiv)
		.append(this.timeDiv)
		.append(this.textDiv);
};
Turn.prototype.isPlayer = function() {
	return this.player;
};
Turn.prototype.update = function(obj) {
	this.obj = obj;

	this.player = uid == this.obj.playerid;

	if (this.obj.turnnum > 0 || this.isPlayer()) {
		Match.current.turnDiv.append(this.turnDiv);
	}

	this.updateDOM();
}
Turn.prototype.updateDOM = function() {
	turn_count = Match.current.gameWindow.find('#turn_count');
	if (this.obj.turnnum > 0) {
		turn_count.show();
	} else {
		turn_count.hide();
	}
	turn_count.find("span:first-child").html(this.obj.turnnum);

	if (this.obj.turnnum == 0) {
		this.turnDiv.addClass('turn_new');
		this.textDiv.text("Your word is " + this.obj.guess);
	} else {
		this.pegsDiv.empty();

		t = 0;
		c = this.obj.correct;
		while (c - t > 0) {
			t++;
			this.pegsDiv.append($("<div/>", {class: "gold"}));
		}
		s = this.obj.displaced;
		while ((s + c) - t > 0) {
			t++;
			this.pegsDiv.append($("<div/>", {class: "silver"}));
		}
		while (t < 4) {
			t++;
			this.pegsDiv.append($("<div/>", {class: "white"}));
		}

		if (this.isPlayer()) {
			this.turnDiv.addClass("turn_player");
		}
		this.textDiv.html(
			(this.isPlayer() ? this.obj.guess : users[this.match.obj.oppid]['name']['givenName'] + " guessed " +
				this.obj.guess +
				(this.obj.correct == 4 ? "<br />" + users[this.match.obj.oppid]['name']['givenName'] + "'s word was " + this.obj.oppword : "")
			)
		);

		if (this.obj.correct == 4) {
			this.turnDiv.addClass("turn_win");
		}

		this.timeDiv.text(timeSince(this.obj.when));
	}
};

// -------------------------------------------------------------------- //

function do_req(url, func, obj, fail) {
	$.getJSON(url, function(data) {
		if (func !== undefined) {
			func(data['response'], data['error'], obj);
		}
	}).fail(function() {
		fail();
	});
}

function setTextContents($elem, text) {
	$elem.contents().filter(function() {
		if (this.nodeType == Node.TEXT_NODE) {
			this.nodeValue = text;
		}
	});
}

var token = "";
var playerid = "";
var uid = "";
var turns = {};
var turnObjs = {};
var users = {};

function signinCallback(authResult) {
	if (authResult['access_token']) {
		token = authResult['access_token'];
		do_req("identify/" + token, idResult);
		gapi.client.request({path: "/plus/v1/people/me", callback: meResult});

		$('#refresh').click(function() { loadGames(); });
		$('#menu_ach').click(function() {
			gapi.client.request({path: "/games/v1/players/me/achievements", callback: achResult});
			gapi.client.request({path: "/games/v1/achievements", callback: achResult});
		});
		$('#menu_log').click(function() {
			$.ajax({
			url: "https://accounts.google.com/o/oauth2/revoke?token=" + token,
			contentType: "application/json",
			dataType: 'jsonp',
			success: function(data) {
				$('#overlay').show();
				playerid = token = "";

				Match.current.gameWindow.css({top: "100%"});
				setTimeout(function() {
					Match.current.gameWindow.remove();
				}, 600);

				$('#gamelist > :first-child').empty();
			}});
		});
		$('#ach_header').click(function() {
			$('#achievements').hide();
		});
	}
}

function achResult(ach) {
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
}

function meResult(usr) {
	uid = usr['id'];
	usr['id'] = 'me';
	userResult(usr);
}

function userResult(usr) {
	users[usr['id']] = usr;
	Match.updateAll();
}

function idResult(res, err) {
	if (err == 0) {
		playerid = res['key'];
		$('#overlay').hide();
		loadGames();
	} else {
		alert('error ' + err);
	}
}

function loadGames() {
	if (!$('#refresh').hasClass('spinner')) {
		$('#refresh').addClass('spinner');
		do_req("getMatches/" + playerid, matchResult);
	}
}

function matchResult(res, err) {
	$('#refresh').removeClass('spinner');
	if (err == 0) {
		for (x in res) {
			Match.update(res[x]);
		}
		Match.sort();
	} else {
		alert('error ' + err);
	}
	setTimeout(function() { if (Match.current === undefined) { $('#gamelist .game').first().click(); } }, 1000);
}

function alphaFail(r, err, obj) {
	obj.alphaStatus |= 2;
	alphaDone(r, err, obj);
}

function alphaDone(r, err, obj) {
	if ((obj.alphaStatus & 2) == 2) {
		obj.alphaStatus &= 1;
		do_req("updateAlpha/" + playerid + "/" + obj.obj.gameid + "/" + obj.obj.alpha, alphaDone, obj, alphaFail);
	} else {
		obj.alphaStatus &= 2;
	}
}

function turnsResult(res, err, obj) {
	for (x in res) {
		obj.updateTurn(res[x]);
	}
}

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
	
var fin = "";
var alpha = $("<div/>", {id: "alpha"});
var keyboard = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
var offset = 0;

for (x in keyboard) {
	var row = $("<div/>");
	for (i = 0; i < keyboard[x].length; i++) {
		row.append($("<span/>", {id: "alpha_" + offset++, text: keyboard[x].substr(i, 1)})
			.click(function() { $(this).toggleClass('hidden'); Match.current.updateAlpha(this.id.substr(6)); })
		);
	}
	alpha.append(row);
}

$(document).keydown(function(e) {
	c = e.keyCode;
	if (c >= 65 && c <= 90 && fin.length < 4) {
		fin += String.fromCharCode(c);
	} else if (c == 8) {
		fin = fin.substr(0, fin.length - 1);
	} else {
		return;
	}
	e.preventDefault();

	for (i = 0; i < 4; i++) {
		Match.current.guessDiv[i].text(fin.substr(i, 1));
		Match.current.guessDiv[i].attr("class", i < fin.length ? "char" : "");
	}
});