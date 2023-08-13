let sgr = {
      bold: {
            param: {
                  on: 1,
                  off: 22,
            },
            flag: 1,
      },
      underline: {
            param: {
                  on: 4,
                  off: 24,
            },
            flag: 2,
      },
      blink: {
            param: {
                  on: 5,
                  off: 25,
            },
            flag: 4,
      },
      inverse: {
            param: {
                  on: 7,
                  off: 27,
            },
            flag: 8,
      },
      invisible: {
            param: {
                  on: 8,
                  off: 28,
            },
            flag: 16,
      },
      italics: {
            param: {
                  on: 3,
                  off: 23,
            },
            flag: 32,
      },

      frame: {
            param: {
                  on: 51,
                  off: 54,
            },
            flag: 64,
      },
      encircle: {
            param: {
                  on: 52,
                  off: 54,
            },
            flag: 128,
      },
      double2: {
            param: {
                  on: '4:2',
                  off: 24,
            },
            flag: 512,
      },
      curly: {
            param: {
                  on: '4:3',
                  off: 24,
            },
            flag: 1028,
      },
      dotted: {
            param: {
                  on: '4:4',
                  off: 24,
            },
            flag: 2048,
      },
      dashed: {
            param: {
                  on: '4:5',
                  off: 24,
            },
            flag: 4096,
      },
      overline: {
            param: {
                  on: 53,
                  off: 55,
            },
            flag: 8192,
      },
      fastblink: {
            param: {
                  on: 6,
                  off: 25,
            },
            flag: 16384,
      },
};

module.exports = sgr;
