/**
 * A three.js 2D sprite mesh with tile management.
 * @author John Turesson
 * @param {[type]} image        Sprite image.
 * @param {[type]} width        Mesh width.
 * @param {[type]} height       Mesh height.
 * @param {[type]} spriteWidth  Tile/sprite width.
 * @param {[type]} spriteHeight Tile/sprite height.
 * @param {[type]} opacity      Opacity.
 */
var Sprite = function(image, width, height, spriteWidth, spriteHeight, opacity) {
    THREE.Mesh.call(this);

    if (width === undefined || height === undefined) {
        width = image.width;
        height = image.height;
    }
    if (spriteWidth === undefined || spriteHeight === undefined) {
        spriteWidth = image.width;
        spriteHeight = image.height;
    }
    this.width = width;
    this.height = height;
    this.spriteWidth = spriteWidth;
    this.spriteHeight = spriteHeight;
    var geometry = new THREE.PlaneGeometry(1, 1);
    //geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0.5, -0.5, 0));
    this.cols = image.width / spriteWidth;
    this.rows = image.height / spriteHeight;
    var texture = new THREE.Texture(image);
    //texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / this.cols, 1 / this.rows);
    var material;
    material = new THREE.MeshBasicMaterial({
        map: texture,
        opacity: opacity ? opacity : 1,
        transparent: true
    });
    texture.needsUpdate = true;
    this.texture = texture;

    this.geometry = geometry;
    this.material = material;

    this.setTile(0);

    this.castShadow = false;
    this.receiveShadow = false;

    this.setSize(width, height);
};

Sprite.prototype = Object.create(THREE.Mesh.prototype);

Sprite.prototype.clone = function(object, recursive) {
    if (object === undefined) {
        object = new Sprite(this.texture.image, this.width, this.height, this.spriteWidth, this.spriteHeight);
    }
    THREE.Object3D.prototype.clone.call(this, object, recursive);

    return object;
};

Sprite.prototype.setSize = function(width, height) {
    this.scale.set(width, height, 1);
};

Sprite.prototype.setImage = function(image) {
    this.material.map = image;
    this.material.needsUpdate = true;
}

Sprite.prototype.setTile = function(index) {
    var y = Math.floor(index / this.cols);
    var x = index - y * this.cols;
    this.texture.offset.x = x / this.cols;
    this.texture.offset.y = 1 - (y + 1) / this.rows;
};

Sprite.prototype.stop = function() {
    Animation.removeAnimation(this.animation);
};

Sprite.prototype.update = function() {
    this.texture.needsUpdate = true;
}