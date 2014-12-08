/**
 * Help object responsible for loading and keeping game assets.
 * @author John Turesson
 */
var ASS = (function() {
    var ASS = {
        images: {}
    };

    ASS.load = function(callback) {
        var nimages = 0,
            images = {
                tile: 'img/tile.png',
                player: 'img/player.png'
            };

        function onloaded() {
            nimages--;
            if (nimages <= 0) {
                callback();
            }
        };

        for (var key in images) {
            nimages++;
            var img = new Image();
            img.onload = onloaded;
            img.src = images[key];
            ASS.images[key] = img;
        }
    };

    return ASS;
})();