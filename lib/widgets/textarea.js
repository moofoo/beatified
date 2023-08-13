/**
 * textarea.js - textarea element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

/*
    Beatified patches add the following
    1. Directional key functionality
    2. Home and End key functionality
    3. 'Windowing' of textarea content (so it scrolls right when overflowing the width of the element,
        and scrolls left/right depending on cursor position, when content length > width

       The original behavior (to scroll to a new line when the content goes over element width) was not intuitive at
       all with textareas that only show a single row / line.
*/

/**
 * Modules
 */

var unicode = require('../unicode');

var nextTick = global.setImmediate || process.nextTick.bind(process);

var Node = require('./node');
var Input = require('./input');



/**
 * Textarea
 */

function Textarea(options) {
  var self = this;

  if (!(this instanceof Node)) {
    return new Textarea(options);
  }

  options = options || {};

  options.scrollable = options.scrollable !== false;

  Input.call(this, options);

  this.screen._listenKeys(this);

  this.value = options.value || '';

  this.__updateCursor = this._updateCursor.bind(this);
  this.on('resize', this.__updateCursor);
  this.on('move', this.__updateCursor);

  if (options.inputOnFocus) {
    this.on('focus', this.readInput.bind(this, null));
  }

  if (!options.inputOnFocus && options.keys) {
    this.on('keypress', function (ch, key) {
      if (self._reading) return;
      if (key.name === 'enter' || (options.vi && key.name === 'i')) {
        return self.readInput();
      }
      if (key.name === 'e') {
        return self.readEditor();
      }
    });
  }

  if (options.mouse) {
    this.on('click', function (data) {
      if (self._reading) return;
      if (data.button !== 'right') return;
      self.readEditor();
    });
  }
}

Textarea.prototype.__proto__ = Input.prototype;

Textarea.prototype.type = 'textarea';


Textarea.prototype.insertText = function (text) {
  const index = this.strX;

  this.value =
    this.value.substring(0, index) + text + this.value.substring(index, this.value.length);

  this.value = this.value.trim();

  this.strX = this.value.length;

  this.screen.program.cursorPos(this.screen.program.y, this.startX + this.value.length);
};

Textarea.prototype.home = function () {
  this.strX = 0;

  var lpos = this._getCoords();

  this.startX = lpos.xi + this.ileft;

  this.screen.program.cursorPos(this.screen.program.y, this.startX);
};

Textarea.prototype.end = function () {
  this.strX = this.getValue().length;

  var lpos = this._getCoords();

  this.startX = lpos.xi + this.ileft;

  this.screen.program.cursorPos(
    this.screen.program.y,
    this.strX < this.width ? this.startX + this.strX : this.startX + this.width - 2
  );
};

const originalReadInput = Textarea.prototype.readInput;

Textarea.prototype._updateCursor = function (get) {
  if (this.screen.focused !== this) {
    return;
  }

  var lpos = get ? this.lpos : this._getCoords();
  if (!lpos) return;

  var last = this._clines[this._clines.length - 1],
    program = this.screen.program,
    line,
    cx,
    cy;

  if (last === '' && this.value[this.value.length - 1] !== '\n') {
    last = this._clines[this._clines.length - 2] || '';
  }

  line = Math.min(
    this._clines.length - 1 - (this.childBase || 0),
    lpos.yl - lpos.yi - this.iheight - 1
  );

  line = Math.max(0, line);

  cy = lpos.yi + this.itop + line;
  cx = lpos.xi + this.ileft + this.strX;

  if (cy === program.y && cx === program.x) {
    return;
  }

  if (cy === program.y) {
    // PATCH
    /*    if (cx > program.x) {
        program.cuf(cx - program.x);
    } else if (cx < program.x) {
        program.cub(program.x - cx);
    }*/
  } else if (cx === program.x) {
    if (cy > program.y) {
      program.cud(cy - program.y);
    } else if (cy < program.y) {
      program.cuu(program.y - cy);
    }
  } else {
    program.cup(cy, cx);
  }
};

Textarea.prototype.input =
  Textarea.prototype.setInput =
  Textarea.prototype.readInput = function (callback) {
    this.updateWindow();

    this.screen.promptOpen = true;

    this.onResize =
      this.onResize ||
      function () {
        this.windowWidth = this.width;
        this.windowRight = this.windowWidth + this.windowLeft;
      }.bind(this);

    this.on('resize', this.onResize);

    this.on('cancel', () => {
      this.screen.promptOpen = false;
      this.removeListener('resize', this.onResize);
    });

    return Reflect.apply(originalReadInput, this, [callback]);
  };


Textarea.prototype._listener = function (ch, key) {
  if (!this.parent) {
    this._done();
    return;
  }
  var done = this._done,
    value = this.value;

  if (key.name === 'return') return;
  if (key.name === 'enter') return;

  var lpos = this._getCoords() || this.lpos;

  this.startX = this.startX || lpos.xi + this.ileft;

  this.strX = this.strX === undefined ? 0 : this.strX;

  if (key.name === 'left' || key.name === 'right') {
    if (key.name === 'left') {
      if (this.strX - 1 >= 0) {
        this.screen.program.cursorBackward();

        this.strX -= 1;
      }
    } else if (key.name === 'right') {
      if (this.strX + 1 <= this.getValue().length) {
        this.screen.program.cursorForward();

        this.strX += 1;
      }
    }
  }

  if (this.options.keys && key.ctrl && key.name === 'e') {
    return this.readEditor();
  }

  let windowReset = false;

  if (key.name === 'escape') {
    done(null, null);
    //   this._done();
  } else if (key.name === 'backspace') {
    if (this.value.length && this.strX > 0) {
      let erase = 0;
      if (this.screen.fullUnicode) {
        if (unicode.isSurrogate(this.value, this.value.length - 2)) {
          // || unicode.isCombining(this.value, this.value.length - 1)) {

          erase = 2;
        } else {
          erase = 1;
        }
      } else {
        erase = 1;
      }

      this.value = this.value.slice(0, this.strX - erase) + this.value.slice(this.strX);

      if (this.screen.program.x - erase > this.startX - 1) {
        this.strX -= erase;

        for (let x = 0; x < erase; x++) {
          this.screen.program.cursorBackward();
        }
      }
    }
  } else if (key.name === 'delete') {
    this.value = this.value.slice(0, this.strX) + this.value.slice(this.strX + 1);
  } else if (key.full === 'home') {
    this.home();
    windowReset = true;
  } else if (key.full === 'end') {
    this.end();
  } else if (ch) {
    if (!/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
      //this.value += ch;

      const index = this.strX;

      this.value =
        this.value.substring(0, index) +
        ch +
        this.value.substring(index, this.value.length);

      this.screen.program.cursorForward();

      this.strX += 1;
    }
  }

  this.updateWindow(windowReset);

  const windowSlice = this.value.slice(this.windowLeft, this.windowRight);

  this.setContent(windowSlice);

  // Fixes some rendering glitches
  if (this.parent) {
    this.parent.render();
  }

  this.screen.render();

  this.windowMove = false;
};

Textarea.prototype.updateWindow = function (reset) {
  if (!this.parent) {
    return;
  }

  this.windowWidth = this.width;
  this.windowLeft = this.windowLeft === undefined ? 0 : this.windowLeft;
  this.windowRight =
    this.windowRight === undefined ? this.windowWidth + this.windowLeft : this.windowRight;
  this.windowMove = false;

  if (reset) {
    this.windowLeft = 0;
    this.windowRight = this.width + this.windowLeft;
  } else {
    if (this.strX + 2 > this.windowRight) {
      while (this.strX + 2 > this.windowRight) {
        this.windowLeft++;
        this.windowRight++;
      }

      this.windowMove = true;
      this.screen.program.cursorBackward();
    } else if (this.windowLeft > 0 && this.strX - 4 < this.windowLeft) {
      while (this.strX - 4 < this.windowLeft) {
        this.windowLeft--;
        this.windowRight--;
      }
      this.windowMove = true;
      this.screen.program.cursorForward();
    }
  }
};

Textarea.prototype._typeScroll = function () {
  // XXX Workaround
  var height = this.height - this.iheight;
  if (this._clines.length - this.childBase > height) {
    this.scroll(this._clines.length);
  }
};

Textarea.prototype.getValue = function () {
  return this.value;
};

Textarea.prototype.setValue = function (value, init = false) {
  var lpos = this._getCoords();
  if (!lpos) {
    return;
  }

  if (value == null) {
    value = this.value;
  }

  if (this._value !== value) {
    this.value = value;
    this._value = value;

    this.setContent(this.value.slice(this.windowLeft, this.windowRight));

    // this._typeScroll();
    this._updateCursor();

    this.startX = this.startX || lpos.xi + this.ileft;

    if (value === '') {
      this.strX = 0;
      this.screen.program.cursorPos(this.screen.program.y, this.startX);
    } else if (init) {
      this.strX = this.getValue().length;
      this.screen.program.cursorPos(
        this.screen.program.y,
        this.startX + this.getValue().length
      );
    }
  }
};

Textarea.prototype.clearInput =
  Textarea.prototype.clearValue = function () {
    return this.setValue('');
  };

Textarea.prototype.submit = function () {
  if (!this.__listener) return;
  return this.__listener('\x1b', { name: 'escape' });
};

Textarea.prototype.cancel = function () {
  if (!this.__listener) return;
  return this.__listener('\x1b', { name: 'escape' });
};

Textarea.prototype.render = function () {
  this.setValue();
  return this._render();
};

Textarea.prototype.editor =
  Textarea.prototype.setEditor =
  Textarea.prototype.readEditor = function (callback) {
    var self = this;

    if (this._reading) {
      var _cb = this._callback
        , cb = callback;

      this._done('stop');

      callback = function (err, value) {
        if (_cb) _cb(err, value);
        if (cb) cb(err, value);
      };
    }

    if (!callback) {
      callback = function () { };
    }

    return this.screen.readEditor({ value: this.value }, function (err, value) {
      if (err) {
        if (err.message === 'Unsuccessful.') {
          self.screen.render();
          return self.readInput(callback);
        }
        self.screen.render();
        self.readInput(callback);
        return callback(err);
      }
      self.setValue(value);
      self.screen.render();
      return self.readInput(callback);
    });
  };

/**
 * Expose
 */

module.exports = Textarea;
