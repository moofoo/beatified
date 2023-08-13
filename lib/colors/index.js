const memoize = require('lodash.memoize');
const nearestColor = require('./antsy-color');
let ansi256 = require('./ansi256.json');
const { Color } = require('./vscode');
const { AttributeData } = require('./xtermjs/attributedata');
const { hexToRGB, RGBToHex, ccolors, colorNames } = require('./old');

/*
    Notes:
        - This code was copied over mostly unmodified from an older project. It's kind of a mess, but it works.

        - The memoization of the match method is a HUGE performance boost in certain cases. For example, performance 
          when scrolling quickly over large amounts of colored text (using the mouse wheel) is extremely poor without memoization.

        - the color conversion code from https://github.com/robey/antsy is more accurate and less janky than blessed's, which was simply
          incorrect in multiple cases. Unfortunately https://github.com/robey/antsy seems to no longer be available. The
          excellent color conversion code I found there will live on in this project, thank you robey.

        - Regarding the isXterm method:
            Conversion methods are used in a couple different contexts, so sometimes you're dealing with numbers -1 to 255,
            sometimes 0x1ff or 511 which is a special case for Blessed, sometimes numbers greater than 255 (following conversion
            by either XTerm or Blessed), sometimes hex codes, and sometimes color names (black, brightblue, etc).

            It's important that we catch the XTerm-converted numbers, since Blessed's bit shifting will not handle them correctly.
            This check is done using XTerm's mode checking methods (palette or RGB). If the result is
            non-zero, then it's an XTerm number.
*/

const ansiHex = ansi256.reduce((acc, curr) => {
    return {
        ...acc,
        [curr.hex]: curr,
    };
}, {});

const xtermAnsi = {};

const checkColor = color => {
    if (color >= 0 && color <= 255) {
        return color;
    }

    if (ansiHex[color]) {
        return ansiHex[color].ansi;
    } else if (xtermAnsi[color]) {
        return xtermAnsi[color].ansi;
    }

    return null;
};

const badOrDefault = color => {
    if (
        color === -1 ||
        color === 0x1ff ||
        color === null ||
        color === undefined ||
        (color.trim && color.trim() === '')
    ) {
        return true;
    }

    return false;
};

const isXterm = (color, layer = 'fg') => {
    let isXterm;

    if (badOrDefault(color)) {
        return false;
    }

    if (typeof color === 'number') {
        if (layer === 'fg' && (color <= 255 || ((color >> 9) & 0x1ff) <= 255)) {
            isXterm = false;
        } else if (layer === 'bg' && (color <= 255 || (color & 0x1ff) <= 255)) {
            isXterm = false;
        } else if (color > 255) {
            isXterm =
                layer === 'fg'
                    ? AttributeData.isFgPalette(color) ||
                    AttributeData.isFgRGB(color)
                    : AttributeData.isBgPalette(color);
        }
    } else {
        isXterm = false;
    }

    return isXterm;
};

const darken = memoize(
    (color, factor, layer) => {
        if (badOrDefault(color)) {
            if (layer === 'fg') {
                color = 7;
            } else {
                return 0;
            }
        }

        let rgb;
        const checked = checkColor(color);

        if (checked !== null) {
            rgb = ansi256[checked].rgb;
        } else if (typeof color === 'string' && color.charAt(0) === '#') {
            rgb = ansi256[nearestColor(hexToRGB(color))].rgb;
        } else if (typeof color === 'number' && color > 255) {
            if (isXterm(color, layer)) {
                rgb = AttributeData.toColorRGB(color);
            } else {
                const blessedNum =
                    layer === 'fg' ? (color >> 9) & 0x1ff : color & 0x1ff;

                if (blessedNum <= 255) {
                    rgb = ansi256[blessedNum].rgb;
                } else {
                    // The XTerm check isn't perfect, so if we end up here try the converstion to RGB
                    rgb = AttributeData.toColorRGB(color);
                }
            }
        } else if (Array.isArray(color)) {
            rgb = color;
        }

        if (!rgb) {
            return -1;
        }

        return nearestColor(...Color.fromArray(rgb).darken(factor).rgbArray);
    },
    (color, factor, layer) =>
        `${color && color.toString
            ? color.toString()
            : color === undefined || color === null
                ? 'u'
                : color
        }${factor}${layer}`
);

const undef = (val = 'u') => {
    return val && val.toString
        ? val.toString()
        : val === undefined || val === null
            ? 'u'
            : val;
};

const _cache = {};


const match = memoize(
    function (r1, g1, b1, layer = 'fg', isXterm, getRGB = false) {
        if (badOrDefault(r1)) {
            if (layer === 'fg') {
                return getRGB ? ansi256[15].rgb : 15;
            } else {
                return getRGB ? ansi256[0].rgb : 0;
            }
        }

        if (!getRGB) {
            const cachedMaybe = checkColor(r1);

            if (cachedMaybe !== null) {
                return cachedMaybe;
            }
        }

        isXterm =
            isXterm !== undefined
                ? isXterm
                : isXterm(color, layer);

        let hex;
        let xtermNum;

        if (typeof r1 === 'string') {
            hex = r1;

            if (hex[0] !== '#') {
                return -1;
            }

            [r1, g1, b1] = hexToRGB(hex);
        } else if (Array.isArray(r1)) {
            (b1 = r1[2]), (g1 = r1[1]), (r1 = r1[0]);
        } else if (typeof color === 'number' && r1 > 255) {
            if (isXterm) {
                xtermNum = r1;
                [r1, g1, b1] = AttributeData.toColorRGB(r1);
            } else {
                const blessedNum =
                    layer === 'fg' ? (r1 >> 9) & 0x1ff : r1 & 0x1ff;

                if (blessedNum <= 255) {
                    return blessedNum;
                } else {
                    xtermNum = r1;
                    [r1, g1, b1] = AttributeData.toColorRGB(r1);
                }
            }
        }

        if (getRGB) {
            return [r1, g1, b1];
        }

        var hash = (r1 << 16) | (g1 << 8) | b1;

        if (_cache[hash] != null) {
            return _cache[hash];
        }

        const nearest = nearestColor(r1, g1, b1);

        _cache[hash] = nearest;

        if (hex && !ansiHex[hex]) {
            ansiHex[hex] = {
                ansi: nearest,
                hex,
                rgb: [r1, g1, b1],
            };
        }

        if (xtermNum && !xtermAnsi[xtermNum]) {
            xtermAnsi[xtermNum] = {
                ansi: nearest,
                rgb: [r1, g1, b1],
            };
        }

        return nearest;
    },
    (r1, g1, b1, layer = 'fg', isXterm, getRGB = false) =>
        `${undef(r1)}${undef(g1)}${undef(b1)}${layer}${isXterm}${getRGB}`
);


const convert = (color, layer = 'fg') => {
    if (badOrDefault(color)) {
        if (layer === 'fg') {
            return 15;
        } else {
            return 0;
        }
    }

    const cachedMaybe = checkColor(color);

    if (cachedMaybe !== null) {
        return cachedMaybe;
    }

    let isXterm = false;

    if (typeof color === 'number' && color > 255) {
        isXterm = isXterm(color, layer);

        if (isXterm) {
            color = AttributeData.toColorRGB(color);
        } else {
            const blessedNum =
                layer === 'fg' ? (color >> 9) & 0x1ff : color & 0x1ff;

            if (blessedNum <= 255) {
                return blessedNum;
            } else {
                color = AttributeData.toColorRGB(color);
            }
        }
    }

    if (typeof color === 'string') {
        color = color.replace(/[\- ]/g, '');
        if (colorNames[color] != null) {
            color = colorNames[color];
        } else {
            color = match(
                color,
                null,
                null,
                layer,
                isXterm,
                false
            );
        }
    } else if (Array.isArray(color)) {
        color = match(
            color[0],
            color[1],
            color[2],
            layer,
            isXterm,
            false
        );
    } else {
        color = match(color, null, null, layer, isXterm, false);
    }

    return color !== -1 ? color : 0x1ff;
};

const vcolors = ansi256.map(entry => entry.hex);

const colors = ansi256.map(entry => entry.rgb);

const reduce = function (color) {
    return color;
};

// modified blend function from https://github.com/xtermjs/xterm.js/blob/376b29673ba174934b1b6339ef3eed8449fec529/src/browser/Color.ts

const blend = memoize(
    (fg = 15, bg = 0, alpha = 0.5) => {
        if (badOrDefault(fg)) {
            fg = 15;
        }

        if (badOrDefault(bg)) {
            bg = 0;
        }

        alpha = 1 - alpha;

        fg = fg >= 0 ? convert(fg, 'fg') : 15;
        bg = bg >= 0 ? convert(bg, 'bg') : 0;

        fg = fg === 0x1ff ? 15 : fg;
        bg = bg === 0x1ff ? 0 : bg;

        fg = ansi256[fg];
        bg = ansi256[bg];

        const a = alpha || (fg.rgba & 0xff) / 255;

        if (a === 1) {
            return fg.ansi;
        }

        const fgR = (fg.rgba >> 24) & 0xff;
        const fgG = (fg.rgba >> 16) & 0xff;
        const fgB = (fg.rgba >> 8) & 0xff;
        const bgR = (bg.rgba >> 24) & 0xff;
        const bgG = (bg.rgba >> 16) & 0xff;
        const bgB = (bg.rgba >> 8) & 0xff;

        const r = bgR + Math.round((fgR - bgR) * a);
        const g = bgG + Math.round((fgG - bgG) * a);
        const b = bgB + Math.round((fgB - bgB) * a);

        return nearestColor(r, g, b);
    },

    (fg, bg, alpha) => `${fg}${bg}${alpha}`
);


module.exports = {
    isXterm,
    darken,
    _cache,
    match,
    convert,
    vcolors,
    colors,
    reduce,
    blend,
    colorNames,
    hexToRGB,
    ccolors,
    RGBToHex
};