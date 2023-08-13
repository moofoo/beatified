/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const { Attributes, FgFlags, BgFlags, UnderlineStyle } = require('./constants');

class AttributeData {
    constructor(fg, bg = 0) {
        this.fg = 0;
        this.bg = 0;
        this.extended = new ExtendedAttrs();
    }

    static toColorRGB(value) {
        return [
            (value >>> Attributes.RED_SHIFT) & 255,
            (value >>> Attributes.GREEN_SHIFT) & 255,
            value & 255,
        ];
    }

    static fromColorRGB(value) {
        return (
            ((value[0] & 255) << Attributes.RED_SHIFT) |
            ((value[1] & 255) << Attributes.GREEN_SHIFT) |
            (value[2] & 255)
        );
    }

    clone() {
        const newObj = new AttributeData();
        newObj.fg = this.fg;
        newObj.bg = this.bg;
        newObj.extended = this.extended.clone();
        return newObj;
    }

    static isFgPalette(fg) { return (fg & Attributes.CM_MASK) === Attributes.CM_P16 || (fg & Attributes.CM_MASK) === Attributes.CM_P256; }
    static isBgPalette(bg) { return (bg & Attributes.CM_MASK) === Attributes.CM_P16 || (bg & Attributes.CM_MASK) === Attributes.CM_P256; }

    static isFgRGB(fg) {
        return (fg & Attributes.CM_MASK) === Attributes.CM_RGB;
    }

    static isBgRGB(bg) {
        return (bg & Attributes.CM_MASK) === Attributes.CM_RGB;
    }

    // flags
    isInverse() {
        return this.fg & FgFlags.INVERSE;
    }
    isBold() {
        return this.fg & FgFlags.BOLD;
    }
    isUnderline() {
        if (this.hasExtendedAttrs() && this.extended.underlineStyle !== UnderlineStyle.NONE) {
            return 1;
        }
        return this.fg & FgFlags.UNDERLINE;
    }

    isBlink() { return this.fg & FgFlags.BLINK; }
    isInvisible() { return this.fg & FgFlags.INVISIBLE; }
    isItalic() { return this.bg & BgFlags.ITALIC; }
    isDim() { return this.bg & BgFlags.DIM; }
    isStrikethrough() { return this.fg & FgFlags.STRIKETHROUGH; }
    isProtected() { return this.bg & BgFlags.PROTECTED; }
    isOverline() { return this.bg & BgFlags.OVERLINE; }

    getFgColorMode(fg) {
        fg = fg || this.fg;
        return fg & Attributes.CM_MASK;
    }
    getBgColorMode(bg) {
        bg = bg || this.bg;
        return bg & Attributes.CM_MASK;
    }





    isFgRGB(fg) {
        fg = fg || this.fg;
        return (fg & Attributes.CM_MASK) === Attributes.CM_RGB;
    }
    isBgRGB(bg) {
        bg = bg || this.bg;
        return (bg & Attributes.CM_MASK) === Attributes.CM_RGB;
    }
    isFgPalette(fg) {
        fg = fg || this.fg;

        return (
            (fg & Attributes.CM_MASK) === Attributes.CM_P16 ||
            (fg & Attributes.CM_MASK) === Attributes.CM_P256
        );
    }
    isBgPalette(bg) {
        bg = bg || this.bg;
        return (
            (bg & Attributes.CM_MASK) === Attributes.CM_P16 ||
            (bg & Attributes.CM_MASK) === Attributes.CM_P256
        );
    }
    isFgDefault() {
        return (this.fg & Attributes.CM_MASK) === 0;
    }
    isBgDefault() {
        return (this.bg & Attributes.CM_MASK) === 0;
    }
    isAttributeDefault() {
        return this.fg === 0 && this.bg === 0;
    }

    // colors
    getFgColor(fg) {
        fg = fg || this.fg;
        switch (fg & Attributes.CM_MASK) {
            case Attributes.CM_P16:
            case Attributes.CM_P256:
                return fg & Attributes.PCOLOR_MASK;
            case Attributes.CM_RGB:
                return fg & Attributes.RGB_MASK;
            default:
                return -1; // CM_DEFAULT defaults to -1
        }
    }
    getBgColor(bg) {
        bg = bg || this.bg;
        switch (bg & Attributes.CM_MASK) {
            case Attributes.CM_P16:
            case Attributes.CM_P256:
                return bg & Attributes.PCOLOR_MASK;
            case Attributes.CM_RGB:
                return bg & Attributes.RGB_MASK;
            default:
                return -1; // CM_DEFAULT defaults to -1
        }
    }

    // extended attrs
    hasExtendedAttrs() {
        return this.bg & BgFlags.HAS_EXTENDED;
    }
    updateExtended() {
        if (this.extended.isEmpty()) {
            this.bg &= ~BgFlags.HAS_EXTENDED;
        } else {
            this.bg |= BgFlags.HAS_EXTENDED;
        }
    }
    getUnderlineColor() {
        if (this.bg & BgFlags.HAS_EXTENDED && ~this.extended.underlineColor) {
            switch (this.extended.underlineColor & Attributes.CM_MASK) {
                case Attributes.CM_P16:
                case Attributes.CM_P256:
                    return (
                        this.extended.underlineColor & Attributes.PCOLOR_MASK
                    );
                case Attributes.CM_RGB:
                    return this.extended.underlineColor & Attributes.RGB_MASK;
                default:
                    return this.getFgColor();
            }
        }
        return this.getFgColor();
    }
    getUnderlineColorMode() {
        return this.bg & BgFlags.HAS_EXTENDED && ~this.extended.underlineColor
            ? this.extended.underlineColor & Attributes.CM_MASK
            : this.getFgColorMode();
    }
    isUnderlineColorRGB() {
        return this.bg & BgFlags.HAS_EXTENDED && ~this.extended.underlineColor
            ? (this.extended.underlineColor & Attributes.CM_MASK) ===
            Attributes.CM_RGB
            : this.isFgRGB();
    }
    isUnderlineColorPalette() {
        return this.bg & BgFlags.HAS_EXTENDED && ~this.extended.underlineColor
            ? (this.extended.underlineColor & Attributes.CM_MASK) ===
            Attributes.CM_P16 ||
            (this.extended.underlineColor & Attributes.CM_MASK) ===
            Attributes.CM_P256
            : this.isFgPalette();
    }
    isUnderlineColorDefault() {
        return this.bg & BgFlags.HAS_EXTENDED && ~this.extended.underlineColor
            ? (this.extended.underlineColor & Attributes.CM_MASK) === 0
            : this.isFgDefault();
    }
    getUnderlineStyle() {
        return this.fg & FgFlags.UNDERLINE
            ? this.bg & BgFlags.HAS_EXTENDED
                ? this.extended.underlineStyle
                : UnderlineStyle.SINGLE
            : UnderlineStyle.NONE;
    }
}

/**
 * Extended attributes for a cell.
 * Holds information about different underline styles and color.
 */
class ExtendedAttrs {
    _ext = 0;
    _urlId = 0;
    constructor(
        ext = 0,
        urlId = 0
    ) {
        this._ext = ext;
        this._urlId = urlId;
    }

    get ext() {
        if (this._urlId) {
            return (
                (this._ext & ~ExtFlags.UNDERLINE_STYLE) |
                (this.underlineStyle << 26)
            );
        }
        return this._ext;
    }
    set ext(value) { this._ext = value; }

    get underlineStyle() {
        // Always return the URL style if it has one
        if (this._urlId) {
            return UnderlineStyle.DASHED;
        }
        return (this._ext & ExtFlags.UNDERLINE_STYLE) >> 26;
    }

    set underlineStyle(value) {
        this._ext &= ~ExtFlags.UNDERLINE_STYLE;
        this._ext |= (value << 26) & ExtFlags.UNDERLINE_STYLE;
    }

    get underlineColor() {
        return this._ext & (Attributes.CM_MASK | Attributes.RGB_MASK);
    }

    set underlineColor(value) {
        this._ext &= ~(Attributes.CM_MASK | Attributes.RGB_MASK);
        this._ext |= value & (Attributes.CM_MASK | Attributes.RGB_MASK);
    }

    get urlId() {
        return this._urlId;
    }

    set urlId(value) {
        this._urlId = value;
    }

    clone() {
        return new ExtendedAttrs(this.underlineStyle, this.underlineColor);
    }

    /**
     * Convenient method to indicate whether the object holds no additional information,
     * that needs to be persistant in the buffer.
     */
    isEmpty() {
        return this.underlineStyle === UnderlineStyle.NONE && this._urlId === 0;
    }
}

module.exports = {
    AttributeData,
    ExtendedAttrs,
};
