/**
 * The main code for Microscope, a game developed for the Ludum Dare #31 2014 game competition.
 * @author John Turesson
 */
window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || function(f) {
	setTimeout(f, 1000 / 30)
};

function approx_distance(dx, dy) {
	var min, max, approx;

	if (dx < 0) dx = -dx;
	if (dy < 0) dy = -dy;

	if (dx < dy) {
		min = dx;
		max = dy;
	} else {
		min = dy;
		max = dx;
	}

	approx = (max * 1007) + (min * 441);
	if (max < (min << 4))
		approx -= (max * 40);

	// add 512 for proper rounding
	return ((approx + 512) >> 10);
}

function accurate_distance(dx, dy) {
	return Math.sqrt(dx * dx + dy * dy);
}

function getTimeString(t) {
	var m, s;
	s = t;
	m = Math.floor(s / 60);
	s = s - m * 60;
	return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
}

var mute = false;
var mutefx = true;

var width = 500,
	height = 500;
var margin = 20;
var gamewidth = width + margin * 2,
	gameheight = height + margin * 2;

var gamewon = false;
var running = false;
var firststep = false;
var movelimit = true;

var background = new SeamlessLoop();
background.addUri('assets/microscopic.mp3', 66998, 'background');
background.callback(function() {
	if (!mute) {
		background.start('background');
	}
});
var bubbles = new SeamlessLoop();
bubbles.addUri('assets/bubbles.mp3', 23745, 'bubbles');
bubbles.callback(function() {
	if (!mute) {
		bubbles.start('bubbles');
	}
});
var fxlosing = new Audio('assets/losing.wav');
var fxlost = new Audio('assets/lost.wav');
var fxwin = new Audio('assets/win.wav');

function enableAudio(bool) {
	mute = !bool;
	if (mute) {
		background.stop();
		bubbles.stop();
	} else {
		background.start('background');
		bubbles.start('bubbles');
	}
}

var time = 0;
var gameinfo = document.getElementById('game-info');
var ogameinfo = 0;
var tgameinfo = 0;
var gameinfosmooth = 3;

var remainingtext = document.getElementById('score-remaining');
var remaining = 0;

var camera, scene, renderer, composer;
var tintshader;
var mesh, geometry, material;

var mouseX = 0,
	mouseY = 0;
var start_time = Date.now();
var second_start_time = start_time;
var check_lost_start_time = start_time;

var keys_down = {};

var items = [];
var enemies = [];
var particles = [];

var container = document.getElementById('canvas-container');
var borderimg = new Image();
borderimg.onload = function() {
	container.style.background = '#97d4c6';
};
borderimg.src = 'img/microscope_border.png';

/**
 * Named for its initial use it is a wrapper for creating a renderable and movable sprite.
 * @param {[type]} x       X position.
 * @param {[type]} y       Y position.
 * @param {[type]} size    Size.
 * @param {[type]} tile    Tile index.
 * @param {[type]} speed   Target speed.
 * @param {[type]} smooth  Movement smoothness.
 * @param {[type]} opacity Opacity.
 */
var Pixel = function(x, y, size, tile, speed, smooth, opacity) {
	var self = {};

	var rx = x,
		ry = y,
		dx = 0,
		dy = 0;
	var walkspeed = speed * 100;
	var walksmooth = smooth;
	var contaminated = false;
	var contamination = 1;
	var contaminationsmooth = 6;
	var tsize = size;
	var sizesmooth = 10;

	self.size = size;
	self.random = false;

	self.sprite = new Sprite(ASS.images.tile, self.size, self.size, 32, 32, opacity ? opacity : 0.5 + Math.random() * 0.5);
	self.sprite.setTile(tile);

	self.move = function(_dx, _dy) {
		dx = _dx != 0 ? _dx : dx;
		dy = _dy != 0 ? _dy : dy;
	};

	self.stop = function() {
		dx = 0;
		dy = 0;
	};

	self.update = function(delta) {
		x += dx * walkspeed * delta;
		y += dy * walkspeed * delta;

		var sx = (x - rx) * walksmooth * delta;
		var sy = (y - ry) * walksmooth * delta;
		rx = rx - sx;
		ry = ry - sy;

		if (movelimit) {
			if (rx < -margin) {
				x += gamewidth;
				rx += gamewidth;
			} else if (rx > gamewidth - margin) {
				x -= gamewidth;
				rx -= gamewidth;
			}
			if (ry < -margin) {
				y += gameheight;
				ry += gameheight;
			} else if (ry > gameheight - margin) {
				y -= gameheight;
				ry -= gameheight;
			}
		}

		contamination = contamination - ((contaminated ? tile + 5 : tile) - contamination) * contaminationsmooth * delta;
		self.sprite.setTile(Math.round(contamination));

		size = 4 - 8 * Math.random();
		tsize = tsize - (size - tsize) * sizesmooth * delta;
		self.sprite.scale.set(self.size + tsize, self.size + tsize, 1);

		self.sprite.position.set(rx + 0.5 - Math.random(), ry + 0.5 - Math.random(), 0);
	};

	self.setContaminated = function(bool) {
		contaminated = bool;
	};

	self.setPosition = function(_x, _y) {
		x = rx = _x;
		y = ry = _y;
	};

	self.hide = function() {
		self.sprite.visible = false;
	};

	self.show = function() {
		self.sprite.visible = true;
	};

	Object.defineProperty(self, "x", {
		get: function() {
			return rx;
		}
	});

	Object.defineProperty(self, "y", {
		get: function() {
			return ry;
		}
	});

	return self;
};

/**
 * The player object.
 */
var player = (function() {
	var self = {};

	var x = width / 2,
		y = height / 2,
		rx = width / 2,
		ry = height / 2,
		dx = 0,
		dy = 0;
	var walkspeed = 500;
	var walksmooth = 5;

	self.size = 16;
	self.random = false;
	self.repelradius = 80;

	self.lost = false;
	self.losing = false;

	var hangle = 0;
	var vangle = 0;

	self.move = function(_dx, _dy) {

		dx = _dx != 0 ? _dx : dx;
		dy = _dy != 0 ? _dy : dy;
	};

	self.stop = function() {
		dx = 0;
		dy = 0;
	};

	self.update = function(delta) {
		if (!self.lost) {
			self.repelradius = 80;

			x += dx * walkspeed * delta;
			y += dy * walkspeed * delta;

			rx = rx - (x - rx) * walksmooth * delta;
			ry = ry - (y - ry) * walksmooth * delta;

			var dist = approx_distance(rx - width / 2, ry - height / 2);
			if (dist > width / 2) {
				var tint = (dist - width / 2) * 0.005;
				if (tint > 1) {
					tint = 1;
					if (!gamewon) {
						tgameinfo = 1;
						gameinfo.innerHTML = "<p>Lost...</p><p class='mini'>Press \"R\" to restart</p>";
					}
					self.lost = true;
					if (!mutefx) {
						fxlost.play();
					}
				} else {
					if (!self.losing) {
						if (!mutefx) {
							fxlosing.play();
						}
						self.losing = true;
					}
					if (!gamewon) {
						tgameinfo = 1;
						gameinfo.innerHTML = "<p>Get back!</p>";
					}
				}
				tintshader.uniforms.tint.value = tint > 1 ? 1 : tint;
			} else {
				tintshader.uniforms.tint.value = 0;
				if (self.losing) {
					if (!gamewon) {
						tgameinfo = 0;
					}
					self.losing = false;
				}
			}

			hangle += delta * Math.PI * 0.5;
			vangle += delta * Math.PI * 0.42;

			self.sprite.scale.set(self.size + Math.cos(hangle), self.size + Math.sin(vangle), 1);
			self.sprite.position.set(rx, ry, 1);
		}
	};

	self.setPosition = function(_x, _y) {
		x = rx = _x;
		y = ry = _y;
	};

	Object.defineProperty(self, "x", {
		get: function() {
			return rx;
		}
	});

	Object.defineProperty(self, "y", {
		get: function() {
			return ry;
		}
	});

	return self;
})();

ASS.load(function() {

	camera = new THREE.OrthographicCamera(0, width, height, 0, 1, 3000);
	camera.position.z = 20;

	scene = new THREE.Scene();

	scene.add(camera);

	var x, y;
	for (var i = 0; i < 500; i++) {
		x = Math.random() * width;
		y = Math.sqrt(Math.pow(height / 2, 2) - Math.pow(x - height / 2, 2));
		y = height / 2 - y + Math.random() * 2 * y;
		var enemy = Pixel(x, y, 32 - Math.random() * 23, 1, 2 + Math.random() * 2, 6, 0.6 + Math.random() * 0.4);
		scene.add(enemy.sprite);
		enemies.push(enemy);
	}

	for (var i = 0; i < 200; i++) {
		x = Math.random() * width;
		y = Math.sqrt(Math.pow(height / 2, 2) - Math.pow(x - height / 2, 2));
		y = height / 2 - y + Math.random() * 2 * y;
		var particle = Pixel(x, y, 2 + Math.random() * 8, 7, 2 + Math.random() * 6, 0.5, 0.4 + Math.random() * 0.6);
		scene.add(particle.sprite);
		particles.push(particle);
	}

	player.sprite = new Sprite(ASS.images.player, player.size, player.size);
	scene.add(player.sprite);

	renderer = new THREE.WebGLRenderer({
		antialias: false
	});
	renderer.setClearColor(0x97d4c6);
	renderer.setSize(width, height);
	container.appendChild(renderer.domElement);

	// postprocessing
	composer = new THREE.EffectComposer(renderer);
	composer.addPass(new THREE.RenderPass(scene, camera));

	var shaderpass = new THREE.ShaderPass(THREE.RadialBlurShader);
	composer.addPass(shaderpass);

	tintshader = new THREE.ShaderPass(THREE.TintShader);
	tintshader.renderToScreen = true;
	composer.addPass(tintshader);

	THREE.DefaultLoadingManager.onProgress = function(item, loaded, total) {
		console.log(item, loaded, total);
	};

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	window.addEventListener('blur', function() {
		running = false;
	});
	window.addEventListener('focus', function() {
		start_time = Date.now();
		second_start_time = Date.now();
		running = true;
	});

	restart();

	animate();

});

function restart() {
	// game contents
	var x, y;
	for (var i = 0; i < enemies.length; i++) {
		x = Math.random() * width;
		y = Math.sqrt(Math.pow(height / 2, 2) - Math.pow(x - height / 2, 2));
		y = height / 2 - y + Math.random() * 2 * y;
		enemies[i].setPosition(x, y);
		enemies[i].show();
	}

	player.setPosition(width / 2, height / 2);
	player.lost = false;
	player.losing = false;

	ogameinfo = 0;
	tgameinfo = 1;
	gameinfo.style.opacity = ogameinfo;
	gameinfo.innerHTML = "<p>Uncontaminate!</p>";
	remaining = enemies.length;
	remainingtext.innerHTML = remaining;
	start_time = Date.now();
	second_start_time = start_time;
	check_lost_start_time = start_time;
	time = 0;
	running = true;
	firststep = false;
	gamewon = false;
	movelimit = true;
}

function onKeyDown(evt) {
	var firsttime = false;
	if (!keys_down[evt.keyCode]) {
		keys_down[evt.keyCode] = true;
		firsttime = true;
	}
	if (firsttime) {
		switch (evt.keyCode) {
			case 32:
				player.random = true;
				break;
			case 13:
				for (var i = 0; i < items.length; i++) {
					items[i].wobble();
				}
				break;
			case 82:
				restart();
				break;
		}
	}
	if (evt.altKey) {
		evt.preventDefault();
	}
	switch (evt.keyCode) {
		case 65:
		case 37:
		case 87:
		case 38:
		case 68:
		case 39:
		case 83:
		case 40:
			evt.preventDefault();
			break;
	}
}

function onKeyUp(evt) {
	keys_down[evt.keyCode] = false;

	switch (evt.keyCode) {
		case 32:
			player.random = false;
			break;
	}
}

/**
 * Main game loop.
 */
function animate() {

	requestAnimationFrame(animate);

	if (running) {
		var end_time = Date.now();
		var delta = (start_time - end_time) / 1000;
		start_time = end_time;
		if (delta > 0.1) {
			delta = 0.1;
		}
		if (!player.lost && end_time - second_start_time >= 1000) {
			second_start_time = end_time;
			time++;
		}

		var hdir = 0,
			vdir = 0;
		if (keys_down[37] || keys_down[65]) {
			hdir++;
		}
		if (keys_down[38] || keys_down[87]) {
			vdir--;
		}
		if (keys_down[39] || keys_down[68]) {
			hdir--;
		}
		if (keys_down[40] || keys_down[83]) {
			vdir++;
		}
		if (!firststep && enemies.length > 0 && (hdir != 0 || vdir != 0)) {
			console.log(hdir, vdir);
			firststep = true;
			movelimit = false;
			tgameinfo = 0;
		}
		player.move(hdir, vdir);

		player.update(delta);

		player.stop();

		var dx, dy, d;
		var lost = 0;
		var checklost = false;
		if (end_time - check_lost_start_time > 100) {
			check_lost_start_time = end_time;
			checklost = true;
		}

		if (!gamewon) {
			for (var i = 0; i < enemies.length; i++) {
				dx = player.x - enemies[i].x;
				dy = player.y - enemies[i].y;
				d = approx_distance(dx, dy);
				if (d < player.repelradius) {
					dx /= d;
					dy /= d;
					enemies[i].setContaminated(true);
				} else {
					dx = 0.5 - Math.random();
					dy = 0.5 - Math.random();
					enemies[i].setContaminated(false);
				}
				if (checklost) {
					d = accurate_distance(enemies[i].x - width / 2, enemies[i].y - height / 2);
					if (d > width / 2 + enemies[i].size / 2 - 25) {
						lost++;
					}
				}
				enemies[i].move(dx, dy);
				enemies[i].update(delta);
			}
			if (lost == enemies.length) {
				for (var i = 0; i < enemies.length; i++) {
					enemies[i].hide();
				}
				if (!mute && bubbles) {
					bubbles.volume(0);
				}
				tgameinfo = 1;
				gameinfo.innerHTML = "<p>Uncontaminated!</p><p class='mini'>Press \"R\" to restart</p><p class='time'>" + getTimeString(time) + "</p>";
				gamewon = true;
				if (!mutefx) {
					fxwin.play();
				}
			} else {
				if (checklost && !mute && bubbles) {
					bubbles.volume(1 - 0.7 * lost / enemies.length);
				}
			}
			if (checklost) {
				remaining = enemies.length - lost;
				remainingtext.innerHTML = remaining;
			}
		}

		for (var i = 0; i < particles.length; i++) {
			particles[i].move(0.5 - Math.random(), 0.5 - Math.random());
			particles[i].update(delta);
		}

		if (ogameinfo != tgameinfo) {
			if (Math.abs(tgameinfo - ogameinfo) < 0.01) {
				ogameinfo = tgameinfo;
			} else {
				ogameinfo = ogameinfo - (tgameinfo - ogameinfo) * gameinfosmooth * delta;
			}
			gameinfo.style.opacity = ogameinfo;
		}

		composer.render();
	}

}