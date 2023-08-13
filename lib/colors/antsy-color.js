// From https://github.com/robey/antsy
// These color conversion methods are more accurate than blessed
// that repository is no longer available, so this code lives on in with Beatified, thank you robey

const COLOR_CUBE = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];

const GRAY_LINE = [
    8, 18, 28, 38, 48, 58, 68, 78, 88, 98, 108, 118, 128, 138, 148, 158, 168,
    178, 188, 198, 208, 218, 228, 238,
];

const ANSI_LINE = [
    [0x00, 0x00, 0x00],
    [0x80, 0x00, 0x00],
    [0x00, 0x80, 0x00],
    [0x80, 0x80, 0x00],
    [0x00, 0x00, 0x80],
    [0x80, 0x00, 0x80],
    [0x00, 0x80, 0x80],
    [0xc0, 0xc0, 0xc0],
    [0x80, 0x80, 0x80],
    [0xff, 0x00, 0x00],
    [0x00, 0xff, 0x00],
    [0xff, 0xff, 0x00],
    [0x00, 0x00, 0xff],
    [0xff, 0x00, 0xff],
    [0x00, 0xff, 0xff],
    [0xff, 0xff, 0xff],
];

const CUBE_OFFSET = 16;
const GRAY_OFFSET = 232;

// returns [ index into color cube, distance ]
function nearest_color_cube(red, green, blue) {
    const redi = find_closest(red, COLOR_CUBE);
    const greeni = find_closest(green, COLOR_CUBE);
    const bluei = find_closest(blue, COLOR_CUBE);
    const distance = color_distance(
        COLOR_CUBE[redi],
        COLOR_CUBE[greeni],
        COLOR_CUBE[bluei],
        red,
        green,
        blue
    );
    return [36 * redi + 6 * greeni + bluei, distance];
}

function nearest_gray(red, green, blue) {
    const gray = (red + green + blue) / 3;
    const i = find_closest(gray, GRAY_LINE);
    const distance = color_distance(
        GRAY_LINE[i],
        GRAY_LINE[i],
        GRAY_LINE[i],
        red,
        green,
        blue
    );
    return [i, distance];
}

function nearest_ansi(red, green, blue) {
    const distances = ANSI_LINE.map(([r, g, b]) =>
        color_distance(r, g, b, red, green, blue)
    );
    const i = find_closest(0, distances);
    return [i, distances[i]];
}


function color_distance(red1, green1, blue1, red2, green2, blue2) {
    return (
        (red1 - red2) * (red1 - red2) +
        (green1 - green2) * (green1 - green2) +
        (blue1 - blue2) * (blue1 - blue2)
    );
}

function find_closest(n, list) {
    let candidate = 0,
        weight = Math.abs(list[candidate] - n);
    for (let i = 1; i < list.length; i++) {
        const w = Math.abs(list[i] - n);
        if (w < weight) {
            candidate = i;
            weight = w;
        }
    }
    return candidate;
}

function nearest_color(red, green, blue) {
    if (Array.isArray(red) && !green && !blue) {
        blue = red[2];
        green = red[1];
        red = red[0];
    }

    const [cube_index, cube_distance] = nearest_color_cube(red, green, blue);
    const [gray_index, gray_distance] = nearest_gray(red, green, blue);
    const [ansi_index, ansi_distance] = nearest_ansi(red, green, blue);

    let result;

    if (cube_distance < gray_distance && cube_distance < ansi_distance) {
        result = CUBE_OFFSET + cube_index;
    } else if (gray_distance < ansi_distance) {
        result = GRAY_OFFSET + gray_index;
    } else {
        result = ansi_index;
    }

    return result;
}

module.exports = nearest_color;
