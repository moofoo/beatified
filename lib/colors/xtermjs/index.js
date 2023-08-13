/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const { stringFromCodePoint } = require('./textdecoder');
const {
    CHAR_DATA_CHAR_INDEX,
    CHAR_DATA_WIDTH_INDEX,
    CHAR_DATA_ATTR_INDEX,
    Content,
} = require('./constants');
const { AttributeData, ExtendedAttrs } = require('./attributedata');

/**
 * CellData - represents a single Cell in the terminal buffer.
 */
class CellData extends AttributeData {
    /** Helper to create CellData from CharData. */
    static fromCharData(value) {
        const obj = new CellData();
        obj.setFromCharData(value);
        return obj;
    }

    /** Primitives from terminal buffer. */
    content = 0;
    fg = 0;
    bg = 0;
    extended = new ExtendedAttrs();
    combinedData = '';
    /** Whether cell contains a combined string. */
    isCombined() {
        return this.content & Content.IS_COMBINED_MASK;
    }
    /** Width of the cell. */
    getWidth() {
        return this.content >> Content.WIDTH_SHIFT;
    }
    /** JS string of the content. */
    getChars(raw = false) {
        if (this.content & Content.IS_COMBINED_MASK) {
            return this.combinedData;
        }
        if (this.content & Content.CODEPOINT_MASK) {
            return stringFromCodePoint(this.content & Content.CODEPOINT_MASK);
        }
        return '';
    }

    /**
     * Codepoint of cell
     * Note this returns the UTF32 codepoint of single chars,
     * if content is a combined string it returns the codepoint
     * of the last char in string to be in line with code in CharData.
     * */
    getCode() {
        return this.isCombined()
            ? this.combinedData.charCodeAt(this.combinedData.length - 1)
            : this.content & Content.CODEPOINT_MASK;
    }
    /** Set data from CharData */
    setFromCharData(value) {
        this.fg = value[CHAR_DATA_ATTR_INDEX];
        this.bg = 0;
        let combined = false;
        // surrogates and combined strings need special treatment
        if (value[CHAR_DATA_CHAR_INDEX].length > 2) {
            combined = true;
        } else if (value[CHAR_DATA_CHAR_INDEX].length === 2) {
            const code = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0);
            // if the 2-char string is a surrogate create single codepoint
            // everything else is combined
            if (0xd800 <= code && code <= 0xdbff) {
                const second = value[CHAR_DATA_CHAR_INDEX].charCodeAt(1);
                if (0xdc00 <= second && second <= 0xdfff) {
                    this.content =
                        ((code - 0xd800) * 0x400 + second - 0xdc00 + 0x10000) |
                        (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
                } else {
                    combined = true;
                }
            } else {
                combined = true;
            }
        } else {
            this.content =
                value[CHAR_DATA_CHAR_INDEX].charCodeAt(0) |
                (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
        }
        if (combined) {
            this.combinedData = value[CHAR_DATA_CHAR_INDEX];
            this.content =
                Content.IS_COMBINED_MASK | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
        } else {
            this.combinedData = '';
        }
    }
    /** Get data as CharData. */
    getAsCharData() {
        return [this.fg, this.getChars(), this.getWidth(), this.getCode()];
    }

    reset() {
        this.content = 0;
        this.fg = 0;
        this.bg = 0;
        this.combinedData = '';
    }
}

module.exports = CellData;
