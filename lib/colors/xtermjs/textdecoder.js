/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Polyfill - Convert UTF32 codepoint into JS string.
 * Note: The built-in String.fromCodePoint happens to be much slower
 *       due to additional sanity checks. We can avoid them since
 *       we always operate on legal UTF32 (granted by the input decoders)
 *       and use this faster version instead.
 */

function stringFromCodePoint(codePoint) {
    if (codePoint > 0xffff) {
        codePoint -= 0x10000;
        return (
            String.fromCharCode((codePoint >> 10) + 0xd800) +
            String.fromCharCode((codePoint % 0x400) + 0xdc00)
        );
    }
    return String.fromCharCode(codePoint);
}

/**
 * Convert UTF32 char codes into JS string.
 * Basically the same as `stringFromCodePoint` but for multiple codepoints
 * in a loop (which is a lot faster).
 */
function utf32ToString(data, start = 0, end = data.length) {
    let result = '';
    for (let i = start; i < end; ++i) {
        let codepoint = data[i];
        if (codepoint > 0xffff) {
            // JS strings are encoded as UTF16, thus a non BMP codepoint gets converted into a surrogate pair
            // conversion rules:
            //  - subtract 0x10000 from code point, leaving a 20 bit number
            //  - add high 10 bits to 0xD800  --> first surrogate
            //  - add low 10 bits to 0xDC00   --> second surrogate
            codepoint -= 0x10000;
            result +=
                String.fromCharCode((codepoint >> 10) + 0xd800) +
                String.fromCharCode((codepoint % 0x400) + 0xdc00);
        } else {
            result += String.fromCharCode(codepoint);
        }
    }
    return result;
}

/**
 * StringToUtf32 - decodes UTF16 sequences into UTF32 codepoints.
 * To keep the decoder in line with JS strings it handles single surrogates as UCS2.
 */

class StringToUtf32 {
    _interim = 0;

    /**
     * Clears interim and resets decoder to clean state.
     */
    clear() {
        this._interim = 0;
    }

    /**
     * Decode JS string to UTF32 codepoints.
     * The methods assumes stream input and will store partly transmitted
     * surrogate pairs and decode them with the next data chunk.
     * Note: The method does no bound checks for target, therefore make sure
     * the provided input data does not exceed the size of `target`.
     * Returns the number of written codepoints in `target`.
     */
    decode(input, target) {
        const length = input.length;

        if (!length) {
            return 0;
        }

        let size = 0;
        let startPos = 0;

        // handle leftover surrogate high
        if (this._interim) {
            const second = input.charCodeAt(startPos++);
            if (0xdc00 <= second && second <= 0xdfff) {
                target[size++] = (this._interim - 0xd800) * 0x400 + second - 0xdc00 + 0x10000;
            } else {
                // illegal codepoint (USC2 handling)
                target[size++] = this._interim;
                target[size++] = second;
            }
            this._interim = 0;
        }

        for (let i = startPos; i < length; ++i) {
            const code = input.charCodeAt(i);
            // surrogate pair first
            if (0xd800 <= code && code <= 0xdbff) {
                if (++i >= length) {
                    this._interim = code;
                    return size;
                }
                const second = input.charCodeAt(i);
                if (0xdc00 <= second && second <= 0xdfff) {
                    target[size++] = (code - 0xd800) * 0x400 + second - 0xdc00 + 0x10000;
                } else {
                    // illegal codepoint (USC2 handling)
                    target[size++] = code;
                    target[size++] = second;
                }
                continue;
            }
            if (code === 0xfeff) {
                // BOM
                continue;
            }
            target[size++] = code;
        }
        return size;
    }
}

/**
 * Utf8Decoder - decodes UTF8 byte sequences into UTF32 codepoints.
 */
class Utf8ToUtf32 {
    interim = new Uint8Array(3);

    /**
     * Clears interim bytes and resets decoder to clean state.
     */
    clear() {
        this.interim.fill(0);
    }

    /**
     * Decodes UTF8 byte sequences in `input` to UTF32 codepoints in `target`.
     * The methods assumes stream input and will store partly transmitted bytes
     * and decode them with the next data chunk.
     * Note: The method does no bound checks for target, therefore make sure
     * the provided data chunk does not exceed the size of `target`.
     * Returns the number of written codepoints in `target`.
     */
    decode(input, target) {
        const length = input.length;

        if (!length) {
            return 0;
        }

        let size = 0;
        let byte1;
        let byte2;
        let byte3;
        let byte4;
        let codepoint = 0;
        let startPos = 0;

        // handle leftover bytes
        if (this.interim[0]) {
            let discardInterim = false;
            let cp = this.interim[0];
            cp &= (cp & 0xe0) === 0xc0 ? 0x1f : (cp & 0xf0) === 0xe0 ? 0x0f : 0x07;
            let pos = 0;
            let tmp;
            while ((tmp = this.interim[++pos] & 0x3f) && pos < 4) {
                cp <<= 6;
                cp |= tmp;
            }
            // missing bytes - read ahead from input
            const type =
                (this.interim[0] & 0xe0) === 0xc0 ? 2 : (this.interim[0] & 0xf0) === 0xe0 ? 3 : 4;
            const missing = type - pos;
            while (startPos < missing) {
                if (startPos >= length) {
                    return 0;
                }
                tmp = input[startPos++];
                if ((tmp & 0xc0) !== 0x80) {
                    // wrong continuation, discard interim bytes completely
                    startPos--;
                    discardInterim = true;
                    break;
                } else {
                    // need to save so we can continue short inputs in next call
                    this.interim[pos++] = tmp;
                    cp <<= 6;
                    cp |= tmp & 0x3f;
                }
            }
            if (!discardInterim) {
                // final test is type dependent
                if (type === 2) {
                    if (cp < 0x80) {
                        // wrong starter byte
                        startPos--;
                    } else {
                        target[size++] = cp;
                    }
                } else if (type === 3) {
                    if (cp < 0x0800 || (cp >= 0xd800 && cp <= 0xdfff) || cp === 0xfeff) {
                        // illegal codepoint or BOM
                    } else {
                        target[size++] = cp;
                    }
                } else {
                    if (cp < 0x010000 || cp > 0x10ffff) {
                        // illegal codepoint
                    } else {
                        target[size++] = cp;
                    }
                }
            }
            this.interim.fill(0);
        }

        // loop through input
        const fourStop = length - 4;
        let i = startPos;
        while (i < length) {
            /**
             * ASCII shortcut with loop unrolled to 4 consecutive ASCII chars.
             * This is a compromise between speed gain for ASCII
             * and penalty for non ASCII:
             * For best ASCII performance the char should be stored directly into target,
             * but even a single attempt to write to target and compare afterwards
             * penalizes non ASCII really bad (-50%), thus we load the char into byteX first,
             * which reduces ASCII performance by ~15%.
             * This trial for ASCII reduces non ASCII performance by ~10% which seems acceptible
             * compared to the gains.
             * Note that this optimization only takes place for 4 consecutive ASCII chars,
             * for any shorter it bails out. Worst case - all 4 bytes being read but
             * thrown away due to the last being a non ASCII char (-10% performance).
             */
            while (
                i < fourStop &&
                !((byte1 = input[i]) & 0x80) &&
                !((byte2 = input[i + 1]) & 0x80) &&
                !((byte3 = input[i + 2]) & 0x80) &&
                !((byte4 = input[i + 3]) & 0x80)
            ) {
                target[size++] = byte1;
                target[size++] = byte2;
                target[size++] = byte3;
                target[size++] = byte4;
                i += 4;
            }

            // reread byte1
            byte1 = input[i++];

            // 1 byte
            if (byte1 < 0x80) {
                target[size++] = byte1;

                // 2 bytes
            } else if ((byte1 & 0xe0) === 0xc0) {
                if (i >= length) {
                    this.interim[0] = byte1;
                    return size;
                }
                byte2 = input[i++];
                if ((byte2 & 0xc0) !== 0x80) {
                    // wrong continuation
                    i--;
                    continue;
                }
                codepoint = ((byte1 & 0x1f) << 6) | (byte2 & 0x3f);
                if (codepoint < 0x80) {
                    // wrong starter byte
                    i--;
                    continue;
                }
                target[size++] = codepoint;

                // 3 bytes
            } else if ((byte1 & 0xf0) === 0xe0) {
                if (i >= length) {
                    this.interim[0] = byte1;
                    return size;
                }
                byte2 = input[i++];
                if ((byte2 & 0xc0) !== 0x80) {
                    // wrong continuation
                    i--;
                    continue;
                }
                if (i >= length) {
                    this.interim[0] = byte1;
                    this.interim[1] = byte2;
                    return size;
                }
                byte3 = input[i++];
                if ((byte3 & 0xc0) !== 0x80) {
                    // wrong continuation
                    i--;
                    continue;
                }
                codepoint = ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f);
                if (
                    codepoint < 0x0800 ||
                    (codepoint >= 0xd800 && codepoint <= 0xdfff) ||
                    codepoint === 0xfeff
                ) {
                    // illegal codepoint or BOM, no i-- here
                    continue;
                }
                target[size++] = codepoint;

                // 4 bytes
            } else if ((byte1 & 0xf8) === 0xf0) {
                if (i >= length) {
                    this.interim[0] = byte1;
                    return size;
                }
                byte2 = input[i++];
                if ((byte2 & 0xc0) !== 0x80) {
                    // wrong continuation
                    i--;
                    continue;
                }
                if (i >= length) {
                    this.interim[0] = byte1;
                    this.interim[1] = byte2;
                    return size;
                }
                byte3 = input[i++];
                if ((byte3 & 0xc0) !== 0x80) {
                    // wrong continuation
                    i--;
                    continue;
                }
                if (i >= length) {
                    this.interim[0] = byte1;
                    this.interim[1] = byte2;
                    this.interim[2] = byte3;
                    return size;
                }
                byte4 = input[i++];
                if ((byte4 & 0xc0) !== 0x80) {
                    // wrong continuation
                    i--;
                    continue;
                }
                codepoint =
                    ((byte1 & 0x07) << 18) |
                    ((byte2 & 0x3f) << 12) |
                    ((byte3 & 0x3f) << 6) |
                    (byte4 & 0x3f);
                if (codepoint < 0x010000 || codepoint > 0x10ffff) {
                    // illegal codepoint, no i-- here
                    continue;
                }
                target[size++] = codepoint;
            } else {
                // illegal byte, just skip
            }
        }
        return size;
    }
}

module.exports = {
    stringFromCodePoint,
    utf32ToString,
    Utf8ToUtf32,
    StringToUtf32,
};
