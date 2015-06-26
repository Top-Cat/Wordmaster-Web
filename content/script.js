function do_req(url, func, obj, fail) {
	$.getJSON(url, function(data) {
		if (func !== undefined) {
			func(data['response'], data['error'], obj);
		}
	}).fail(function() {
		fail();
	});
}

var token = "";
var playerid = "";
var uid = "";
var games = {};
var gameObjs = {};
var turns = {};
var turnObjs = {};
var currentGame = "";
var currentScreen = null;
var newScreen = null;
var users = {};

function signinCallback(authResult) {
	console.log(authResult);
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
				setTimeout(showScreen, 10, currentScreen);
				$('#gamelist > :first-child').empty();
			}});
		});
		$('#ach_header').click(function() {
			$('#achievements').hide();
		});
	}
}

var achievements = {};
var secretAch = {achievementState: "REVEALED", revealedIconUrl: "content/lock.png", name: "Secret", description: "Keep playing to learn more"};

function achResult(ach) {
	show = (Object.keys(achievements).length > 0);
	for (x in ach.items) {
		achievements[ach.items[x].id] = collect(ach.items[x], achievements[ach.items[x].id]);
	}
	if (show) {
		$('#ach_list').empty();
		html = "";
		unlocked = 0;
		for (x in achievements) {
			if (achievements[x].achievementState != "HIDDEN") {
				cAch = achievements[x];
			} else {
				cAch = secretAch;
			}
			achElem = $('<div>' + cAch.description + '</div>');
			achElem.prepend($('<h1>' + cAch.name + '</h1>'));
			if (cAch.achievementState == "UNLOCKED") {
				unlocked++;
				achElem.prepend($('<span class="unlocked"></span>'));
			}
			if (cAch.achievementType == "INCREMENTAL" && cAch.achievementState == "REVEALED") {
				percent = d(cAch.currentSteps * 360, cAch.totalSteps);
				html += '<span class="progress"><span class="text">' + d(cAch.currentSteps * 100, cAch.totalSteps) + '%</span>';
				if (percent > 180) {
					html += '<span class="circle"></span>';
					percent -= 360;
				} else {
					html += '<span class="progress_half">';
				}
				html += '<span class="circle" style="-webkit-transform: rotate(' + percent + 'deg)"></span></span>';
				if (percent >= 0) {
					html += "</span>";
				}
			} else {
				achElem.prepend($('<img src="' + (cAch.achievementState == "UNLOCKED" ? cAch.unlockedIconUrl : cAch.revealedIconUrl) + '" />'));
			}
			$('#ach_list').append(achElem);
		}
		
		$('#ach_list').prepend(
			$('<h1>' + unlocked + '/' + Object.keys(achievements).length + ' unlocked</h1>')
			.append($('<span></span>')
				.append($('<b></b>')
					.text(d(unlocked * 100, Object.keys(achievements).length) + '%')
				).append($('<span></span>')
					.width(d(unlocked * 90, Object.keys(achievements).length))
				)
			)
		);
		$('#achievements').show();
	}
}

function collect() {
	var ret = {};
	var len = arguments.length;
	for (var i=0; i<len; i++) {
		for (p in arguments[i]) {
			if (arguments[i].hasOwnProperty(p)) {
				ret[p] = arguments[i][p];
			}
		}
	}
	return ret;
}

function meResult(usr) {
	uid = usr['id'];
	usr['id'] = 'me';
	userResult(usr);
}

function userResult(usr) {
	users[usr['id']] = usr;
	for (x in games) {
		if (games[x]['oppid'] == usr['id']) {
			updateMatchObj(x);
		}
	}
}

function idResult(res, err) {
	if (err == 0) {
		playerid = res['key'];
		document.getElementById('overlay').style.display = 'none';
		loadGames();
	} else {
		alert('error ' + err);
	}
}

function loadGames() {
	if (document.getElementById('refresh') != null) {
		document.getElementById('refresh').id = 'spinner';
		do_req("getMatches/" + playerid, matchResult);
	}
}

function matchResult(res, err) {
	document.getElementById('spinner').id = 'refresh';
	if (err == 0) {
		for (x in res) {
			games[res[x]['gameid']] = res[x];
			if (!(res[x]['gameid'] in gameObjs)) {
				gapi.client.request({path: "/plus/v1/people/" + res[x]['oppid'], callback: userResult});

				var obj = document.createElement('div');
				obj.className = 'game';
				obj.id = res[x]['gameid'];
				obj.onclick = function() { showMatch(this.id); };
				gameObjs[res[x]['gameid']] = obj;
				document.getElementById('gamelist').firstChild.appendChild(obj);
			}
			updateMatchObj(res[x]['gameid']);
		}
		sortMatches();
	} else {
		alert('error ' + err);
	}
	setTimeout(function() { if (currentGame.length == 0) { for (elem in gameObjs) { showMatch(gameObjs[elem].id); return; } } }, 1000);
}

function sortMatches() {
	var sortableGames = [];
	for (var key in games) sortableGames.push(games[key]);
	sortableGames.sort(function(a, b) {
		var ev1 = (a['turn'] ? 1 : 0) | (a['needword'] ? 2 : 0);
		var ev2 = (b['turn'] ? 1 : 0) | (b['needword'] ? 2 : 0);
		var r = ev2 - ev1;
		if (r == 0) {
			return b['updated'] - a['updated'];
		}
		return r;
	});
	for (x in sortableGames) {
		document.getElementById('gamelist').firstChild.appendChild(gameObjs[sortableGames[x]['gameid']]);
	}
}

function updateMatchObj(id) {
	out = "";
	if (games[id]['oppid'] in users) {
		usr = users[games[id]['oppid']];
		out += "<img src='" + usr['image']['url'] + "' />vs " + usr['displayName'];
	}
	out += "<div class='time'>" + timeSince(games[id]['updated']) + "</div>";
	if (games[id]['turn'] || games[id]['needword']) {
		out += "<div class='note'></div>";
	}
	gameObjs[id].innerHTML = out;
}

function showMatch(id) {
	if (transitioning) {
		return;
	}

	if (currentGame.length > 0) {
		gameObjs[currentGame].className = "game";
	}
	currentGame = id;
	gameObjs[currentGame].className = "game selectedgame";

	newScreen = document.createElement('div');
	newScreen.className = 'gameWindow';
	newScreen.innerHTML = '<div id="scores"><div id="me">0</div><div id="opp">0</div></div><div id="turns"></div><div id="alpha">' + alpha + '</div><div id="footer"><div id="turn_count">Turn<span>2</span></div><div id="guess"><div></div><div></div><div></div><div></div></div></div>';
	for (i = 0; i < 26; i++) {
		alpha_obj = newScreen.querySelector('#alpha_' + i);
		alpha_obj.onclick = function() {
			updateAlpha(this);
		};
		alpha_obj.className = ((games[currentGame].alpha >> i) & 1) == 1 ? 'hidden' : '';
	}

	document.getElementById('rightpane').appendChild(newScreen);
	setTimeout(showScreen, 10, currentScreen, newScreen);
	fin = "";
	currentScreen = newScreen;
	newScreen = null;
	transitioning = true;

	if ('me' in users) {
		currentScreen.querySelector('#me').style.backgroundImage = "url('" + users['me']['image']['url'] + "')";
	}
	if (games[currentGame]['oppid'] in users) {
		currentScreen.querySelector('#opp').style.backgroundImage = "url('" + users[games[currentGame]['oppid']]['image']['url'] + "')";
	}

	for (x in turnObjs[currentGame]) {
		turnObjs[currentGame][x] = turnObjs[currentGame][x].cloneNode(true);
		currentScreen.querySelector('#turns').appendChild(turnObjs[currentGame][x]);
		updateTurnObj(x);
	}

	do_req("getTurns/" + playerid + "/" + id, turnsResult, currentGame);
}

function updateAlpha(obj) {
	id = obj.id.substr(6);
	games[currentGame].alpha ^= (1 << id);
	obj.className = ((games[currentGame].alpha >> id) & 1) == 1 ? 'hidden' : '';
	if ((games[currentGame].alphaStatus & 1) == 0) {
		games[currentGame].alphaStatus |= 1;
		do_req("updateAlpha/" + playerid + "/" + currentGame + "/" + games[currentGame].alpha, alphaDone, currentGame, alphaFail);
	} else {
		games[currentGame].alphaStatus |= 2;
	}
}

function alphaFail(obj, err, id) {
	alphaStatus |= 2;
	alphaDone();
}

function alphaDone(obj, err, id) {
	if ((games[id].alphaStatus & 2) == 2) {
		games[id].alphaStatus &= 1;
		do_req("updateAlpha/" + playerid + "/" + currentGame + "/" + games[currentGame].alpha, alphaDone, id, alphaFail);
	} else {
		games[id].alphaStatus &= 2;
	}
}

function get_random_color() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.round(Math.random() * 15)];
    }
    return color;
}

function hideScreen(screen) {
	document.getElementById('rightpane').removeChild(screen);
}

function showScreen(cscreen, nscreen) {
	setTimeout(allowChange, 600);
	if (cscreen != null) {
		cscreen.style.top = "100%";
		setTimeout(hideScreen, 600, cscreen);
	}
	nscreen.style.top = "0px";
}

var transitioning = false;
function allowChange() {
	transitioning = false;
}

function turnsResult(res, err, id) {
	if (currentGame == id) {
		if (turns[id] === undefined) {
			turns[id] = {};
			turnObjs[id] = {};
		}
		for (x in res) {
			turns[id][res[x]['turnid']] = res[x];
			if (!(res[x]['turnid'] in turnObjs[id])) {
				var obj = document.createElement('div');
				obj.id = res[x]['turnid'];
				turnObjs[id][res[x]['turnid']] = obj;
				currentScreen.querySelector('#turns').appendChild(obj);
			}
			updateTurnObj(res[x]['turnid']);
		}
	}
}

function updateTurnObj(id) {
	out = "";
	isPlayer = uid == turns[currentGame][id]['playerid'];

	turn_count = currentScreen.querySelector('#turn_count')
	turn_count.style.display = turns[currentGame][id]['turnnum'] > 0 ? "block" : "none";
	turn_count.getElementsByTagName("span")[0].innerHTML = turns[currentGame][id]['turnnum'];

	if (turns[currentGame][id]['turnnum'] > 0 || isPlayer) {
		if (turns[currentGame][id]['turnnum'] == 0) {
			turnObjs[currentGame][id].className = 'turn_new_round';
			out += "Your word is " + turns[currentGame][id]['guess'];
		} else {
			pegs = "<div class='pegs'>";
			t = 0;
			c = turns[currentGame][id]['correct'];
			while (c - t > 0) {
				t++;
				pegs += "<div class='gold'></div>";
			}
			s = turns[currentGame][id]['displaced'];
			while ((s + c) - t > 0) {
				t++;
				pegs += "<div class='silver'></div>";
			}
			while (t < 4) {
				t++;
				pegs += "<div class='white'></div>";
			}
			pegs += "</div>";
			if (isPlayer) {
				if (turns[currentGame][id]['correct'] == 4) {
					out += "<img src='content/crown_flipped.png' style='margin-right: 10px; vertical-align: text-top' />";
					turnObjs[currentGame][id].className = 'turn_win';
				} else {
					turnObjs[currentGame][id].className = 'turn_big';
					out += pegs;
				}
				out += turns[currentGame][id]['guess'];
			out += "<div class='time'>" + timeSince(turns[currentGame][id]['when']) + "</div>";
			} else {
				out += "<div class='time'>" + timeSince(turns[currentGame][id]['when']) + "</div>";
				out += "<span>" + users[games[currentGame]['oppid']]['name']['givenName'] + " guessed " + turns[currentGame][id]['guess'] + "</span>";
				if (turns[currentGame][id]['correct'] == 4) {
					turnObjs[currentGame][id].className = 'turn_lose';
					out += "<img src='content/crown.png' />";
					out += "<br /><span>" + users[games[currentGame]['oppid']]['name']['givenName'] + "'s word was " + turns[currentGame][id]['oppword'] + "</span>";
				} else {
					turnObjs[currentGame][id].className = 'turn_small';
					out += pegs;
				}
			}
		}
	}
	turnObjs[currentGame][id].innerHTML = out;
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

document.onkeydown = function(e) {
	c = e.keyCode;
	if (c >= 65 && c <= 90 && fin.length < 4) {
		fin += String.fromCharCode(c);
	} else if (c == 8) {
		fin = fin.substr(0, fin.length - 1);
	} else {
		return;
	}
	e.preventDefault();
	txtBox = "";
	for (i = 0; i < 4; i++) {
		if (i < fin.length) {
			txtBox += "<span>" + fin.substr(i, 1) + "</span>";
		} else {
			txtBox += "<div></div>";
		}
	}
	currentScreen.querySelector("#guess").innerHTML = txtBox;
}


var alpha = "";
var keyboard = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
var offset = 0;

for (x in keyboard) {
	alpha += '<div>';
	for (i = 0; i < keyboard[x].length; i++) {
		alpha += '<span id="alpha_' + offset++ + '">' + keyboard[x].substr(i, 1) + '</span>';
	}
	alpha += '</div>';
}
