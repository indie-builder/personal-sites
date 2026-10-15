//#region ../../node_modules/.bun/@shuding+opentype.js@1.4.0-beta.0/node_modules/@shuding/opentype.js/dist/opentype.module.js
/**
* https://opentype.js.org v1.3.5 | (c) Frederik De Bleser and other contributors | MIT License | Uses fflate by 101arrowz and string.prototype.codepointat polyfill by Mathias Bynens
*/
var u8 = Uint8Array;
var u16 = Uint16Array;
var u32 = Uint32Array;
var fleb = new u8([
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	3,
	3,
	3,
	3,
	4,
	4,
	4,
	4,
	5,
	5,
	5,
	5,
	0,
	0,
	0,
	0
]);
var fdeb = new u8([
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	6,
	7,
	7,
	8,
	8,
	9,
	9,
	10,
	10,
	11,
	11,
	12,
	12,
	13,
	13,
	0,
	0
]);
var clim = new u8([
	16,
	17,
	18,
	0,
	8,
	7,
	9,
	6,
	10,
	5,
	11,
	4,
	12,
	3,
	13,
	2,
	14,
	1,
	15
]);
var freb = function(eb, start) {
	var b = new u16(31);
	for (var i = 0; i < 31; ++i) b[i] = start += 1 << eb[i - 1];
	var r = new u32(b[30]);
	for (var i = 1; i < 30; ++i) for (var j = b[i]; j < b[i + 1]; ++j) r[j] = j - b[i] << 5 | i;
	return [b, r];
};
var _a = freb(fleb, 2);
var fl = _a[0];
var revfl = _a[1];
fl[28] = 258, revfl[258] = 28;
var fd = freb(fdeb, 0)[0];
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
	var x = (i & 43690) >>> 1 | (i & 21845) << 1;
	x = (x & 52428) >>> 2 | (x & 13107) << 2;
	x = (x & 61680) >>> 4 | (x & 3855) << 4;
	rev[i] = ((x & 65280) >>> 8 | (x & 255) << 8) >>> 1;
}
var hMap = (function(cd, mb, r) {
	var s = cd.length;
	var i = 0;
	var l = new u16(mb);
	for (; i < s; ++i) if (cd[i]) ++l[cd[i] - 1];
	var le = new u16(mb);
	for (i = 0; i < mb; ++i) le[i] = le[i - 1] + l[i - 1] << 1;
	var co;
	if (r) {
		co = new u16(1 << mb);
		var rvb = 15 - mb;
		for (i = 0; i < s; ++i) if (cd[i]) {
			var sv = i << 4 | cd[i];
			var r_1 = mb - cd[i];
			var v = le[cd[i] - 1]++ << r_1;
			for (var m = v | (1 << r_1) - 1; v <= m; ++v) co[rev[v] >>> rvb] = sv;
		}
	} else {
		co = new u16(s);
		for (i = 0; i < s; ++i) if (cd[i]) co[i] = rev[le[cd[i] - 1]++] >>> 15 - cd[i];
	}
	return co;
});
var flt = new u8(288);
for (var i = 0; i < 144; ++i) flt[i] = 8;
for (var i = 144; i < 256; ++i) flt[i] = 9;
for (var i = 256; i < 280; ++i) flt[i] = 7;
for (var i = 280; i < 288; ++i) flt[i] = 8;
var fdt = new u8(32);
for (var i = 0; i < 32; ++i) fdt[i] = 5;
var flrm = /*#__PURE__*/ hMap(flt, 9, 1);
var fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);
var max = function(a) {
	var m = a[0];
	for (var i = 1; i < a.length; ++i) if (a[i] > m) m = a[i];
	return m;
};
var bits = function(d, p, m) {
	var o = p / 8 | 0;
	return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
	var o = p / 8 | 0;
	return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
	return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
	if (s == null || s < 0) s = 0;
	if (e == null || e > v.length) e = v.length;
	var n = new (v.BYTES_PER_ELEMENT == 2 ? u16 : v.BYTES_PER_ELEMENT == 4 ? u32 : u8)(e - s);
	n.set(v.subarray(s, e));
	return n;
};
var ec = [
	"unexpected EOF",
	"invalid block type",
	"invalid length/literal",
	"invalid distance",
	"stream finished",
	"no stream handler",
	,
	"no callback",
	"invalid UTF-8 data",
	"extra field too long",
	"date not in range 1980-2099",
	"filename too long",
	"stream finishing",
	"invalid zip data"
];
var err = function(ind, msg, nt) {
	var e = new Error(msg || ec[ind]);
	e.code = ind;
	if (Error.captureStackTrace) Error.captureStackTrace(e, err);
	if (!nt) throw e;
	return e;
};
var inflt = function(dat, buf, st) {
	var sl = dat.length;
	if (!sl || st && st.f && !st.l) return buf || new u8(0);
	var noBuf = !buf || st;
	var noSt = !st || st.i;
	if (!st) st = {};
	if (!buf) buf = new u8(sl * 3);
	var cbuf = function(l) {
		var bl = buf.length;
		if (l > bl) {
			var nbuf = new u8(Math.max(bl * 2, l));
			nbuf.set(buf);
			buf = nbuf;
		}
	};
	var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
	var tbts = sl * 8;
	do {
		if (!lm) {
			final = bits(dat, pos, 1);
			var type = bits(dat, pos + 1, 3);
			pos += 3;
			if (!type) {
				var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
				if (t > sl) {
					if (noSt) err(0);
					break;
				}
				if (noBuf) cbuf(bt + l);
				buf.set(dat.subarray(s, t), bt);
				st.b = bt += l, st.p = pos = t * 8, st.f = final;
				continue;
			} else if (type == 1) lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
			else if (type == 2) {
				var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
				var tl = hLit + bits(dat, pos + 5, 31) + 1;
				pos += 14;
				var ldt = new u8(tl);
				var clt = new u8(19);
				for (var i = 0; i < hcLen; ++i) clt[clim[i]] = bits(dat, pos + i * 3, 7);
				pos += hcLen * 3;
				var clb = max(clt), clbmsk = (1 << clb) - 1;
				var clm = hMap(clt, clb, 1);
				for (var i = 0; i < tl;) {
					var r = clm[bits(dat, pos, clbmsk)];
					pos += r & 15;
					var s = r >>> 4;
					if (s < 16) ldt[i++] = s;
					else {
						var c = 0, n = 0;
						if (s == 16) n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
						else if (s == 17) n = 3 + bits(dat, pos, 7), pos += 3;
						else if (s == 18) n = 11 + bits(dat, pos, 127), pos += 7;
						while (n--) ldt[i++] = c;
					}
				}
				var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
				lbt = max(lt);
				dbt = max(dt);
				lm = hMap(lt, lbt, 1);
				dm = hMap(dt, dbt, 1);
			} else err(1);
			if (pos > tbts) {
				if (noSt) err(0);
				break;
			}
		}
		if (noBuf) cbuf(bt + 131072);
		var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
		var lpos = pos;
		for (;; lpos = pos) {
			var c = lm[bits16(dat, pos) & lms], sym = c >>> 4;
			pos += c & 15;
			if (pos > tbts) {
				if (noSt) err(0);
				break;
			}
			if (!c) err(2);
			if (sym < 256) buf[bt++] = sym;
			else if (sym == 256) {
				lpos = pos, lm = null;
				break;
			} else {
				var add = sym - 254;
				if (sym > 264) {
					var i = sym - 257, b = fleb[i];
					add = bits(dat, pos, (1 << b) - 1) + fl[i];
					pos += b;
				}
				var d = dm[bits16(dat, pos) & dms], dsym = d >>> 4;
				if (!d) err(3);
				pos += d & 15;
				var dt = fd[dsym];
				if (dsym > 3) {
					var b = fdeb[dsym];
					dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
				}
				if (pos > tbts) {
					if (noSt) err(0);
					break;
				}
				if (noBuf) cbuf(bt + 131072);
				var end = bt + add;
				for (; bt < end; bt += 4) {
					buf[bt] = buf[bt - dt];
					buf[bt + 1] = buf[bt + 1 - dt];
					buf[bt + 2] = buf[bt + 2 - dt];
					buf[bt + 3] = buf[bt + 3 - dt];
				}
				bt = end;
			}
		}
		st.l = lm, st.p = lpos, st.b = bt, st.f = final;
		if (lm) final = 1, st.m = lbt, st.d = dm, st.n = dbt;
	} while (!final);
	return bt == buf.length ? buf : slc(buf, 0, bt);
};
var et = /*#__PURE__*/ new u8(0);
/**
* Expands DEFLATE data with no wrapper
* @param data The data to decompress
* @param out Where to write the data. Saves memory if you know the decompressed size and provide an output buffer of that length.
* @returns The decompressed version of the data
*/
function inflateSync(data, out) {
	return inflt(data, out);
}
var td = typeof TextDecoder != "undefined" && /*#__PURE__*/ new TextDecoder();
try {
	td.decode(et, { stream: true });
} catch (e) {}
/**
* A bézier path containing a set of path commands similar to a SVG path.
* Paths can be drawn on a context using `draw`.
* @exports opentype.Path
* @class
* @constructor
*/
function Path() {
	this.commands = [];
	this.fill = "black";
	this.stroke = null;
	this.strokeWidth = 1;
}
/**
* @param  {number} x
* @param  {number} y
*/
Path.prototype.moveTo = function(x, y) {
	this.commands.push({
		type: "M",
		x,
		y
	});
};
/**
* @param  {number} x
* @param  {number} y
*/
Path.prototype.lineTo = function(x, y) {
	this.commands.push({
		type: "L",
		x,
		y
	});
};
/**
* Draws cubic curve
* @function
* curveTo
* @memberof opentype.Path.prototype
* @param  {number} x1 - x of control 1
* @param  {number} y1 - y of control 1
* @param  {number} x2 - x of control 2
* @param  {number} y2 - y of control 2
* @param  {number} x - x of path point
* @param  {number} y - y of path point
*/
/**
* Draws cubic curve
* @function
* bezierCurveTo
* @memberof opentype.Path.prototype
* @param  {number} x1 - x of control 1
* @param  {number} y1 - y of control 1
* @param  {number} x2 - x of control 2
* @param  {number} y2 - y of control 2
* @param  {number} x - x of path point
* @param  {number} y - y of path point
* @see curveTo
*/
Path.prototype.curveTo = Path.prototype.bezierCurveTo = function(x1, y1, x2, y2, x, y) {
	this.commands.push({
		type: "C",
		x1,
		y1,
		x2,
		y2,
		x,
		y
	});
};
/**
* Draws quadratic curve
* @function
* quadraticCurveTo
* @memberof opentype.Path.prototype
* @param  {number} x1 - x of control
* @param  {number} y1 - y of control
* @param  {number} x - x of path point
* @param  {number} y - y of path point
*/
/**
* Draws quadratic curve
* @function
* quadTo
* @memberof opentype.Path.prototype
* @param  {number} x1 - x of control
* @param  {number} y1 - y of control
* @param  {number} x - x of path point
* @param  {number} y - y of path point
*/
Path.prototype.quadTo = Path.prototype.quadraticCurveTo = function(x1, y1, x, y) {
	this.commands.push({
		type: "Q",
		x1,
		y1,
		x,
		y
	});
};
/**
* Closes the path
* @function closePath
* @memberof opentype.Path.prototype
*/
/**
* Close the path
* @function close
* @memberof opentype.Path.prototype
*/
Path.prototype.close = Path.prototype.closePath = function() {
	this.commands.push({ type: "Z" });
};
/**
* Add the given path or list of commands to the commands of this path.
* @param  {Array} pathOrCommands - another opentype.Path, an opentype.BoundingBox, or an array of commands.
*/
Path.prototype.extend = function(pathOrCommands) {
	if (pathOrCommands.commands) pathOrCommands = pathOrCommands.commands;
	Array.prototype.push.apply(this.commands, pathOrCommands);
};
/**
* Convert the Path to a string of path data instructions
* See http://www.w3.org/TR/SVG/paths.html#PathData
* @param  {number} [decimalPlaces=2] - The amount of decimal places for floating-point values
* @return {string}
*/
Path.prototype.toPathData = function(decimalPlaces) {
	decimalPlaces = decimalPlaces !== void 0 ? decimalPlaces : 2;
	function floatToString(v) {
		if (Math.round(v) === v) return "" + Math.round(v);
		else return v.toFixed(decimalPlaces);
	}
	function packValues() {
		var arguments$1 = arguments;
		var s = "";
		for (var i = 0; i < arguments.length; i += 1) {
			var v = arguments$1[i];
			if (v >= 0 && i > 0) s += " ";
			s += floatToString(v);
		}
		return s;
	}
	var d = "";
	for (var i = 0; i < this.commands.length; i += 1) {
		var cmd = this.commands[i];
		if (cmd.type === "M") d += "M" + packValues(cmd.x, cmd.y);
		else if (cmd.type === "L") d += "L" + packValues(cmd.x, cmd.y);
		else if (cmd.type === "C") d += "C" + packValues(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
		else if (cmd.type === "Q") d += "Q" + packValues(cmd.x1, cmd.y1, cmd.x, cmd.y);
		else if (cmd.type === "Z") d += "Z";
	}
	return d;
};
var cffStandardStrings = [
	".notdef",
	"space",
	"exclam",
	"quotedbl",
	"numbersign",
	"dollar",
	"percent",
	"ampersand",
	"quoteright",
	"parenleft",
	"parenright",
	"asterisk",
	"plus",
	"comma",
	"hyphen",
	"period",
	"slash",
	"zero",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"colon",
	"semicolon",
	"less",
	"equal",
	"greater",
	"question",
	"at",
	"A",
	"B",
	"C",
	"D",
	"E",
	"F",
	"G",
	"H",
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q",
	"R",
	"S",
	"T",
	"U",
	"V",
	"W",
	"X",
	"Y",
	"Z",
	"bracketleft",
	"backslash",
	"bracketright",
	"asciicircum",
	"underscore",
	"quoteleft",
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"k",
	"l",
	"m",
	"n",
	"o",
	"p",
	"q",
	"r",
	"s",
	"t",
	"u",
	"v",
	"w",
	"x",
	"y",
	"z",
	"braceleft",
	"bar",
	"braceright",
	"asciitilde",
	"exclamdown",
	"cent",
	"sterling",
	"fraction",
	"yen",
	"florin",
	"section",
	"currency",
	"quotesingle",
	"quotedblleft",
	"guillemotleft",
	"guilsinglleft",
	"guilsinglright",
	"fi",
	"fl",
	"endash",
	"dagger",
	"daggerdbl",
	"periodcentered",
	"paragraph",
	"bullet",
	"quotesinglbase",
	"quotedblbase",
	"quotedblright",
	"guillemotright",
	"ellipsis",
	"perthousand",
	"questiondown",
	"grave",
	"acute",
	"circumflex",
	"tilde",
	"macron",
	"breve",
	"dotaccent",
	"dieresis",
	"ring",
	"cedilla",
	"hungarumlaut",
	"ogonek",
	"caron",
	"emdash",
	"AE",
	"ordfeminine",
	"Lslash",
	"Oslash",
	"OE",
	"ordmasculine",
	"ae",
	"dotlessi",
	"lslash",
	"oslash",
	"oe",
	"germandbls",
	"onesuperior",
	"logicalnot",
	"mu",
	"trademark",
	"Eth",
	"onehalf",
	"plusminus",
	"Thorn",
	"onequarter",
	"divide",
	"brokenbar",
	"degree",
	"thorn",
	"threequarters",
	"twosuperior",
	"registered",
	"minus",
	"eth",
	"multiply",
	"threesuperior",
	"copyright",
	"Aacute",
	"Acircumflex",
	"Adieresis",
	"Agrave",
	"Aring",
	"Atilde",
	"Ccedilla",
	"Eacute",
	"Ecircumflex",
	"Edieresis",
	"Egrave",
	"Iacute",
	"Icircumflex",
	"Idieresis",
	"Igrave",
	"Ntilde",
	"Oacute",
	"Ocircumflex",
	"Odieresis",
	"Ograve",
	"Otilde",
	"Scaron",
	"Uacute",
	"Ucircumflex",
	"Udieresis",
	"Ugrave",
	"Yacute",
	"Ydieresis",
	"Zcaron",
	"aacute",
	"acircumflex",
	"adieresis",
	"agrave",
	"aring",
	"atilde",
	"ccedilla",
	"eacute",
	"ecircumflex",
	"edieresis",
	"egrave",
	"iacute",
	"icircumflex",
	"idieresis",
	"igrave",
	"ntilde",
	"oacute",
	"ocircumflex",
	"odieresis",
	"ograve",
	"otilde",
	"scaron",
	"uacute",
	"ucircumflex",
	"udieresis",
	"ugrave",
	"yacute",
	"ydieresis",
	"zcaron",
	"exclamsmall",
	"Hungarumlautsmall",
	"dollaroldstyle",
	"dollarsuperior",
	"ampersandsmall",
	"Acutesmall",
	"parenleftsuperior",
	"parenrightsuperior",
	"266 ff",
	"onedotenleader",
	"zerooldstyle",
	"oneoldstyle",
	"twooldstyle",
	"threeoldstyle",
	"fouroldstyle",
	"fiveoldstyle",
	"sixoldstyle",
	"sevenoldstyle",
	"eightoldstyle",
	"nineoldstyle",
	"commasuperior",
	"threequartersemdash",
	"periodsuperior",
	"questionsmall",
	"asuperior",
	"bsuperior",
	"centsuperior",
	"dsuperior",
	"esuperior",
	"isuperior",
	"lsuperior",
	"msuperior",
	"nsuperior",
	"osuperior",
	"rsuperior",
	"ssuperior",
	"tsuperior",
	"ff",
	"ffi",
	"ffl",
	"parenleftinferior",
	"parenrightinferior",
	"Circumflexsmall",
	"hyphensuperior",
	"Gravesmall",
	"Asmall",
	"Bsmall",
	"Csmall",
	"Dsmall",
	"Esmall",
	"Fsmall",
	"Gsmall",
	"Hsmall",
	"Ismall",
	"Jsmall",
	"Ksmall",
	"Lsmall",
	"Msmall",
	"Nsmall",
	"Osmall",
	"Psmall",
	"Qsmall",
	"Rsmall",
	"Ssmall",
	"Tsmall",
	"Usmall",
	"Vsmall",
	"Wsmall",
	"Xsmall",
	"Ysmall",
	"Zsmall",
	"colonmonetary",
	"onefitted",
	"rupiah",
	"Tildesmall",
	"exclamdownsmall",
	"centoldstyle",
	"Lslashsmall",
	"Scaronsmall",
	"Zcaronsmall",
	"Dieresissmall",
	"Brevesmall",
	"Caronsmall",
	"Dotaccentsmall",
	"Macronsmall",
	"figuredash",
	"hypheninferior",
	"Ogoneksmall",
	"Ringsmall",
	"Cedillasmall",
	"questiondownsmall",
	"oneeighth",
	"threeeighths",
	"fiveeighths",
	"seveneighths",
	"onethird",
	"twothirds",
	"zerosuperior",
	"foursuperior",
	"fivesuperior",
	"sixsuperior",
	"sevensuperior",
	"eightsuperior",
	"ninesuperior",
	"zeroinferior",
	"oneinferior",
	"twoinferior",
	"threeinferior",
	"fourinferior",
	"fiveinferior",
	"sixinferior",
	"seveninferior",
	"eightinferior",
	"nineinferior",
	"centinferior",
	"dollarinferior",
	"periodinferior",
	"commainferior",
	"Agravesmall",
	"Aacutesmall",
	"Acircumflexsmall",
	"Atildesmall",
	"Adieresissmall",
	"Aringsmall",
	"AEsmall",
	"Ccedillasmall",
	"Egravesmall",
	"Eacutesmall",
	"Ecircumflexsmall",
	"Edieresissmall",
	"Igravesmall",
	"Iacutesmall",
	"Icircumflexsmall",
	"Idieresissmall",
	"Ethsmall",
	"Ntildesmall",
	"Ogravesmall",
	"Oacutesmall",
	"Ocircumflexsmall",
	"Otildesmall",
	"Odieresissmall",
	"OEsmall",
	"Oslashsmall",
	"Ugravesmall",
	"Uacutesmall",
	"Ucircumflexsmall",
	"Udieresissmall",
	"Yacutesmall",
	"Thornsmall",
	"Ydieresissmall",
	"001.000",
	"001.001",
	"001.002",
	"001.003",
	"Black",
	"Bold",
	"Book",
	"Light",
	"Medium",
	"Regular",
	"Roman",
	"Semibold"
];
var cffStandardEncoding = [
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"space",
	"exclam",
	"quotedbl",
	"numbersign",
	"dollar",
	"percent",
	"ampersand",
	"quoteright",
	"parenleft",
	"parenright",
	"asterisk",
	"plus",
	"comma",
	"hyphen",
	"period",
	"slash",
	"zero",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"colon",
	"semicolon",
	"less",
	"equal",
	"greater",
	"question",
	"at",
	"A",
	"B",
	"C",
	"D",
	"E",
	"F",
	"G",
	"H",
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q",
	"R",
	"S",
	"T",
	"U",
	"V",
	"W",
	"X",
	"Y",
	"Z",
	"bracketleft",
	"backslash",
	"bracketright",
	"asciicircum",
	"underscore",
	"quoteleft",
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"k",
	"l",
	"m",
	"n",
	"o",
	"p",
	"q",
	"r",
	"s",
	"t",
	"u",
	"v",
	"w",
	"x",
	"y",
	"z",
	"braceleft",
	"bar",
	"braceright",
	"asciitilde",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"exclamdown",
	"cent",
	"sterling",
	"fraction",
	"yen",
	"florin",
	"section",
	"currency",
	"quotesingle",
	"quotedblleft",
	"guillemotleft",
	"guilsinglleft",
	"guilsinglright",
	"fi",
	"fl",
	"",
	"endash",
	"dagger",
	"daggerdbl",
	"periodcentered",
	"",
	"paragraph",
	"bullet",
	"quotesinglbase",
	"quotedblbase",
	"quotedblright",
	"guillemotright",
	"ellipsis",
	"perthousand",
	"",
	"questiondown",
	"",
	"grave",
	"acute",
	"circumflex",
	"tilde",
	"macron",
	"breve",
	"dotaccent",
	"dieresis",
	"",
	"ring",
	"cedilla",
	"",
	"hungarumlaut",
	"ogonek",
	"caron",
	"emdash",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"AE",
	"",
	"ordfeminine",
	"",
	"",
	"",
	"",
	"Lslash",
	"Oslash",
	"OE",
	"ordmasculine",
	"",
	"",
	"",
	"",
	"",
	"ae",
	"",
	"",
	"",
	"dotlessi",
	"",
	"",
	"lslash",
	"oslash",
	"oe",
	"germandbls"
];
var cffExpertEncoding = [
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"space",
	"exclamsmall",
	"Hungarumlautsmall",
	"",
	"dollaroldstyle",
	"dollarsuperior",
	"ampersandsmall",
	"Acutesmall",
	"parenleftsuperior",
	"parenrightsuperior",
	"twodotenleader",
	"onedotenleader",
	"comma",
	"hyphen",
	"period",
	"fraction",
	"zerooldstyle",
	"oneoldstyle",
	"twooldstyle",
	"threeoldstyle",
	"fouroldstyle",
	"fiveoldstyle",
	"sixoldstyle",
	"sevenoldstyle",
	"eightoldstyle",
	"nineoldstyle",
	"colon",
	"semicolon",
	"commasuperior",
	"threequartersemdash",
	"periodsuperior",
	"questionsmall",
	"",
	"asuperior",
	"bsuperior",
	"centsuperior",
	"dsuperior",
	"esuperior",
	"",
	"",
	"isuperior",
	"",
	"",
	"lsuperior",
	"msuperior",
	"nsuperior",
	"osuperior",
	"",
	"",
	"rsuperior",
	"ssuperior",
	"tsuperior",
	"",
	"ff",
	"fi",
	"fl",
	"ffi",
	"ffl",
	"parenleftinferior",
	"",
	"parenrightinferior",
	"Circumflexsmall",
	"hyphensuperior",
	"Gravesmall",
	"Asmall",
	"Bsmall",
	"Csmall",
	"Dsmall",
	"Esmall",
	"Fsmall",
	"Gsmall",
	"Hsmall",
	"Ismall",
	"Jsmall",
	"Ksmall",
	"Lsmall",
	"Msmall",
	"Nsmall",
	"Osmall",
	"Psmall",
	"Qsmall",
	"Rsmall",
	"Ssmall",
	"Tsmall",
	"Usmall",
	"Vsmall",
	"Wsmall",
	"Xsmall",
	"Ysmall",
	"Zsmall",
	"colonmonetary",
	"onefitted",
	"rupiah",
	"Tildesmall",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"exclamdownsmall",
	"centoldstyle",
	"Lslashsmall",
	"",
	"",
	"Scaronsmall",
	"Zcaronsmall",
	"Dieresissmall",
	"Brevesmall",
	"Caronsmall",
	"",
	"Dotaccentsmall",
	"",
	"",
	"Macronsmall",
	"",
	"",
	"figuredash",
	"hypheninferior",
	"",
	"",
	"Ogoneksmall",
	"Ringsmall",
	"Cedillasmall",
	"",
	"",
	"",
	"onequarter",
	"onehalf",
	"threequarters",
	"questiondownsmall",
	"oneeighth",
	"threeeighths",
	"fiveeighths",
	"seveneighths",
	"onethird",
	"twothirds",
	"",
	"",
	"zerosuperior",
	"onesuperior",
	"twosuperior",
	"threesuperior",
	"foursuperior",
	"fivesuperior",
	"sixsuperior",
	"sevensuperior",
	"eightsuperior",
	"ninesuperior",
	"zeroinferior",
	"oneinferior",
	"twoinferior",
	"threeinferior",
	"fourinferior",
	"fiveinferior",
	"sixinferior",
	"seveninferior",
	"eightinferior",
	"nineinferior",
	"centinferior",
	"dollarinferior",
	"periodinferior",
	"commainferior",
	"Agravesmall",
	"Aacutesmall",
	"Acircumflexsmall",
	"Atildesmall",
	"Adieresissmall",
	"Aringsmall",
	"AEsmall",
	"Ccedillasmall",
	"Egravesmall",
	"Eacutesmall",
	"Ecircumflexsmall",
	"Edieresissmall",
	"Igravesmall",
	"Iacutesmall",
	"Icircumflexsmall",
	"Idieresissmall",
	"Ethsmall",
	"Ntildesmall",
	"Ogravesmall",
	"Oacutesmall",
	"Ocircumflexsmall",
	"Otildesmall",
	"Odieresissmall",
	"OEsmall",
	"Oslashsmall",
	"Ugravesmall",
	"Uacutesmall",
	"Ucircumflexsmall",
	"Udieresissmall",
	"Yacutesmall",
	"Thornsmall",
	"Ydieresissmall"
];
/**
* This is the encoding used for fonts created from scratch.
* It loops through all glyphs and finds the appropriate unicode value.
* Since it's linear time, other encodings will be faster.
* @exports opentype.DefaultEncoding
* @class
* @constructor
* @param {opentype.Font}
*/
function DefaultEncoding(font) {
	this.font = font;
}
DefaultEncoding.prototype.charToGlyphIndex = function(c) {
	var code = c.codePointAt(0);
	var glyphs = this.font.glyphs;
	if (glyphs) for (var i = 0; i < glyphs.length; i += 1) {
		var glyph = glyphs.get(i);
		for (var j = 0; j < glyph.unicodes.length; j += 1) if (glyph.unicodes[j] === code) return i;
	}
	return null;
};
/**
* @exports opentype.CmapEncoding
* @class
* @constructor
* @param {Object} cmap - a object with the cmap encoded data
*/
function CmapEncoding(cmap) {
	this.cmap = cmap;
}
/**
* @param  {string} c - the character
* @return {number} The glyph index.
*/
CmapEncoding.prototype.charToGlyphIndex = function(c) {
	return this.cmap.glyphIndexMap[c.codePointAt(0)] || 0;
};
/**
* @exports opentype.CffEncoding
* @class
* @constructor
* @param {string} encoding - The encoding
* @param {Array} charset - The character set.
*/
function CffEncoding(encoding, charset) {
	this.encoding = encoding;
	this.charset = charset;
}
/**
* @param  {string} s - The character
* @return {number} The index.
*/
CffEncoding.prototype.charToGlyphIndex = function(s) {
	var code = s.codePointAt(0);
	var charName = this.encoding[code];
	return this.charset.indexOf(charName);
};
function addGlyphNamesAll(font) {
	var glyph;
	var glyphIndexMap = font.tables.cmap.glyphIndexMap;
	var charCodes = Object.keys(glyphIndexMap);
	for (var i = 0; i < charCodes.length; i += 1) {
		var c = charCodes[i];
		var glyphIndex = glyphIndexMap[c];
		glyph = font.glyphs.get(glyphIndex);
		glyph.addUnicode(parseInt(c));
	}
}
function addGlyphNamesToUnicodeMap(font) {
	font._IndexToUnicodeMap = {};
	var glyphIndexMap = font.tables.cmap.glyphIndexMap;
	var charCodes = Object.keys(glyphIndexMap);
	for (var i = 0; i < charCodes.length; i += 1) {
		var c = charCodes[i];
		var glyphIndex = glyphIndexMap[c];
		if (font._IndexToUnicodeMap[glyphIndex] === void 0) font._IndexToUnicodeMap[glyphIndex] = { unicodes: [parseInt(c)] };
		else font._IndexToUnicodeMap[glyphIndex].unicodes.push(parseInt(c));
	}
}
/**
* @alias opentype.addGlyphNames
* @param {opentype.Font}
* @param {Object}
*/
function addGlyphNames(font, opt) {
	if (opt.lowMemory) addGlyphNamesToUnicodeMap(font);
	else addGlyphNamesAll(font);
}
function fail(message) {
	throw new Error(message);
}
function argument(predicate, message) {
	if (!predicate) fail(message);
}
var check = {
	fail,
	argument,
	assert: argument
};
function getPathDefinition(glyph, path) {
	var _path = path || new Path();
	return {
		configurable: true,
		get: function() {
			if (typeof _path === "function") _path = _path();
			return _path;
		},
		set: function(p) {
			_path = p;
		}
	};
}
/**
* @typedef GlyphOptions
* @type Object
* @property {string} [name] - The glyph name
* @property {number} [unicode]
* @property {Array} [unicodes]
* @property {number} [xMin]
* @property {number} [yMin]
* @property {number} [xMax]
* @property {number} [yMax]
* @property {number} [advanceWidth]
*/
/**
* @exports opentype.Glyph
* @class
* @param {GlyphOptions}
* @constructor
*/
function Glyph(options) {
	this.bindConstructorValues(options);
}
/**
* @param  {GlyphOptions}
*/
Glyph.prototype.bindConstructorValues = function(options) {
	this.index = options.index || 0;
	this.name = options.name || null;
	this.unicode = options.unicode || void 0;
	this.unicodes = options.unicodes || options.unicode !== void 0 ? [options.unicode] : [];
	if ("xMin" in options) this.xMin = options.xMin;
	if ("yMin" in options) this.yMin = options.yMin;
	if ("xMax" in options) this.xMax = options.xMax;
	if ("yMax" in options) this.yMax = options.yMax;
	if ("advanceWidth" in options) this.advanceWidth = options.advanceWidth;
	Object.defineProperty(this, "path", getPathDefinition(this, options.path));
};
/**
* @param {number}
*/
Glyph.prototype.addUnicode = function(unicode) {
	if (this.unicodes.length === 0) this.unicode = unicode;
	this.unicodes.push(unicode);
};
/**
* Convert the glyph to a Path we can draw on a drawing context.
* @param  {number} [x=0] - Horizontal position of the beginning of the text.
* @param  {number} [y=0] - Vertical position of the *baseline* of the text.
* @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
* @param  {Object=} options - xScale, yScale to stretch the glyph.
* @param  {opentype.Font} if hinting is to be used, the font
* @return {opentype.Path}
*/
Glyph.prototype.getPath = function(x, y, fontSize, options, font) {
	x = x !== void 0 ? x : 0;
	y = y !== void 0 ? y : 0;
	fontSize = fontSize !== void 0 ? fontSize : 72;
	var commands;
	var hPoints;
	if (!options) options = {};
	var xScale = options.xScale;
	var yScale = options.yScale;
	if (options.hinting && font && font.hinting) hPoints = this.path && font.hinting.exec(this, fontSize);
	if (hPoints) {
		commands = font.hinting.getCommands(hPoints);
		x = Math.round(x);
		y = Math.round(y);
		xScale = yScale = 1;
	} else {
		commands = this.path.commands;
		var scale = 1 / (this.path.unitsPerEm || 1e3) * fontSize;
		if (xScale === void 0) xScale = scale;
		if (yScale === void 0) yScale = scale;
	}
	var p = new Path();
	for (var i = 0; i < commands.length; i += 1) {
		var cmd = commands[i];
		if (cmd.type === "M") p.moveTo(x + cmd.x * xScale, y + -cmd.y * yScale);
		else if (cmd.type === "L") p.lineTo(x + cmd.x * xScale, y + -cmd.y * yScale);
		else if (cmd.type === "Q") p.quadraticCurveTo(x + cmd.x1 * xScale, y + -cmd.y1 * yScale, x + cmd.x * xScale, y + -cmd.y * yScale);
		else if (cmd.type === "C") p.curveTo(x + cmd.x1 * xScale, y + -cmd.y1 * yScale, x + cmd.x2 * xScale, y + -cmd.y2 * yScale, x + cmd.x * xScale, y + -cmd.y * yScale);
		else if (cmd.type === "Z") p.closePath();
	}
	return p;
};
/**
* Split the glyph into contours.
* This function is here for backwards compatibility, and to
* provide raw access to the TrueType glyph outlines.
* @return {Array}
*/
Glyph.prototype.getContours = function() {
	if (this.points === void 0) return [];
	var contours = [];
	var currentContour = [];
	for (var i = 0; i < this.points.length; i += 1) {
		var pt = this.points[i];
		currentContour.push(pt);
		if (pt.lastPointOfContour) {
			contours.push(currentContour);
			currentContour = [];
		}
	}
	check.argument(currentContour.length === 0, "There are still points left in the current contour.");
	return contours;
};
/**
* Calculate the xMin/yMin/xMax/yMax/lsb/rsb for a Glyph.
* @return {Object}
*/
Glyph.prototype.getMetrics = function() {
	var commands = this.path.commands;
	var xCoords = [];
	var yCoords = [];
	for (var i = 0; i < commands.length; i += 1) {
		var cmd = commands[i];
		if (cmd.type !== "Z") {
			xCoords.push(cmd.x);
			yCoords.push(cmd.y);
		}
		if (cmd.type === "Q" || cmd.type === "C") {
			xCoords.push(cmd.x1);
			yCoords.push(cmd.y1);
		}
		if (cmd.type === "C") {
			xCoords.push(cmd.x2);
			yCoords.push(cmd.y2);
		}
	}
	var metrics = {
		xMin: Math.min.apply(null, xCoords),
		yMin: Math.min.apply(null, yCoords),
		xMax: Math.max.apply(null, xCoords),
		yMax: Math.max.apply(null, yCoords),
		leftSideBearing: this.leftSideBearing
	};
	if (!isFinite(metrics.xMin)) metrics.xMin = 0;
	if (!isFinite(metrics.xMax)) metrics.xMax = this.advanceWidth;
	if (!isFinite(metrics.yMin)) metrics.yMin = 0;
	if (!isFinite(metrics.yMax)) metrics.yMax = 0;
	metrics.rightSideBearing = this.advanceWidth - metrics.leftSideBearing - (metrics.xMax - metrics.xMin);
	return metrics;
};
function defineDependentProperty(glyph, externalName, internalName) {
	Object.defineProperty(glyph, externalName, {
		get: function() {
			glyph.path;
			return glyph[internalName];
		},
		set: function(newValue) {
			glyph[internalName] = newValue;
		},
		enumerable: true,
		configurable: true
	});
}
/**
* A GlyphSet represents all glyphs available in the font, but modelled using
* a deferred glyph loader, for retrieving glyphs only once they are absolutely
* necessary, to keep the memory footprint down.
* @exports opentype.GlyphSet
* @class
* @param {opentype.Font}
* @param {Array}
*/
function GlyphSet(font, glyphs) {
	this.font = font;
	this.glyphs = {};
	if (Array.isArray(glyphs)) for (var i = 0; i < glyphs.length; i++) {
		var glyph = glyphs[i];
		glyph.path.unitsPerEm = font.unitsPerEm;
		this.glyphs[i] = glyph;
	}
	this.length = glyphs && glyphs.length || 0;
}
/**
* @param  {number} index
* @return {opentype.Glyph}
*/
GlyphSet.prototype.get = function(index) {
	if (this.glyphs[index] === void 0) {
		this.font._push(index);
		if (typeof this.glyphs[index] === "function") this.glyphs[index] = this.glyphs[index]();
		var glyph = this.glyphs[index];
		var unicodeObj = this.font._IndexToUnicodeMap[index];
		if (unicodeObj) for (var j = 0; j < unicodeObj.unicodes.length; j++) glyph.addUnicode(unicodeObj.unicodes[j]);
		this.glyphs[index].advanceWidth = this.font._hmtxTableData[index].advanceWidth;
		this.glyphs[index].leftSideBearing = this.font._hmtxTableData[index].leftSideBearing;
	} else if (typeof this.glyphs[index] === "function") this.glyphs[index] = this.glyphs[index]();
	return this.glyphs[index];
};
/**
* @param  {number} index
* @param  {Object}
*/
GlyphSet.prototype.push = function(index, loader) {
	this.glyphs[index] = loader;
	this.length++;
};
/**
* @alias opentype.glyphLoader
* @param  {opentype.Font} font
* @param  {number} index
* @return {opentype.Glyph}
*/
function glyphLoader(font, index) {
	return new Glyph({
		index,
		font
	});
}
/**
* Generate a stub glyph that can be filled with all metadata *except*
* the "points" and "path" properties, which must be loaded only once
* the glyph's path is actually requested for text shaping.
* @alias opentype.ttfGlyphLoader
* @param  {opentype.Font} font
* @param  {number} index
* @param  {Function} parseGlyph
* @param  {Object} data
* @param  {number} position
* @param  {Function} buildPath
* @return {opentype.Glyph}
*/
function ttfGlyphLoader(font, index, parseGlyph, data, position, buildPath) {
	return function() {
		var glyph = new Glyph({
			index,
			font
		});
		glyph.path = function() {
			parseGlyph(glyph, data, position);
			var path = buildPath(font.glyphs, glyph);
			path.unitsPerEm = font.unitsPerEm;
			return path;
		};
		defineDependentProperty(glyph, "xMin", "_xMin");
		defineDependentProperty(glyph, "xMax", "_xMax");
		defineDependentProperty(glyph, "yMin", "_yMin");
		defineDependentProperty(glyph, "yMax", "_yMax");
		return glyph;
	};
}
/**
* @alias opentype.cffGlyphLoader
* @param  {opentype.Font} font
* @param  {number} index
* @param  {Function} parseCFFCharstring
* @param  {string} charstring
* @return {opentype.Glyph}
*/
function cffGlyphLoader(font, index, parseCFFCharstring, charstring) {
	return function() {
		var glyph = new Glyph({
			index,
			font
		});
		glyph.path = function() {
			var path = parseCFFCharstring(font, glyph, charstring);
			path.unitsPerEm = font.unitsPerEm;
			return path;
		};
		return glyph;
	};
}
var glyphset = {
	GlyphSet,
	glyphLoader,
	ttfGlyphLoader,
	cffGlyphLoader
};
function searchTag(arr, tag) {
	var imin = 0;
	var imax = arr.length - 1;
	while (imin <= imax) {
		var imid = imin + imax >>> 1;
		var val = arr[imid].tag;
		if (val === tag) return imid;
		else if (val < tag) imin = imid + 1;
		else imax = imid - 1;
	}
	return -imin - 1;
}
function binSearch(arr, value) {
	var imin = 0;
	var imax = arr.length - 1;
	while (imin <= imax) {
		var imid = imin + imax >>> 1;
		var val = arr[imid];
		if (val === value) return imid;
		else if (val < value) imin = imid + 1;
		else imax = imid - 1;
	}
	return -imin - 1;
}
function searchRange(ranges, value) {
	var range;
	var imin = 0;
	var imax = ranges.length - 1;
	while (imin <= imax) {
		var imid = imin + imax >>> 1;
		range = ranges[imid];
		var start = range.start;
		if (start === value) return range;
		else if (start < value) imin = imid + 1;
		else imax = imid - 1;
	}
	if (imin > 0) {
		range = ranges[imin - 1];
		if (value > range.end) return 0;
		return range;
	}
}
/**
* @exports opentype.Layout
* @class
*/
function Layout(font, tableName) {
	this.font = font;
	this.tableName = tableName;
}
Layout.prototype = {
	/**
	* Binary search an object by "tag" property
	* @instance
	* @function searchTag
	* @memberof opentype.Layout
	* @param  {Array} arr
	* @param  {string} tag
	* @return {number}
	*/
	searchTag,
	/**
	* Binary search in a list of numbers
	* @instance
	* @function binSearch
	* @memberof opentype.Layout
	* @param  {Array} arr
	* @param  {number} value
	* @return {number}
	*/
	binSearch,
	/**
	* Get or create the Layout table (GSUB, GPOS etc).
	* @param  {boolean} create - Whether to create a new one.
	* @return {Object} The GSUB or GPOS table.
	*/
	getTable: function(create) {
		var layout = this.font.tables[this.tableName];
		if (!layout && create) layout = this.font.tables[this.tableName] = this.createDefaultTable();
		return layout;
	},
	/**
	* Returns the best bet for a script name.
	* Returns 'DFLT' if it exists.
	* If not, returns 'latn' if it exists.
	* If neither exist, returns undefined.
	*/
	getDefaultScriptName: function() {
		var layout = this.getTable();
		if (!layout) return;
		var hasLatn = false;
		for (var i = 0; i < layout.scripts.length; i++) {
			var name = layout.scripts[i].tag;
			if (name === "DFLT") return name;
			if (name === "latn") hasLatn = true;
		}
		if (hasLatn) return "latn";
	},
	/**
	* Returns all LangSysRecords in the given script.
	* @instance
	* @param {string} [script='DFLT']
	* @param {boolean} create - forces the creation of this script table if it doesn't exist.
	* @return {Object} An object with tag and script properties.
	*/
	getScriptTable: function(script, create) {
		var layout = this.getTable(create);
		if (layout) {
			script = script || "DFLT";
			var scripts = layout.scripts;
			var pos = searchTag(layout.scripts, script);
			if (pos >= 0) return scripts[pos].script;
			else if (create) {
				var scr = {
					tag: script,
					script: {
						defaultLangSys: {
							reserved: 0,
							reqFeatureIndex: 65535,
							featureIndexes: []
						},
						langSysRecords: []
					}
				};
				scripts.splice(-1 - pos, 0, scr);
				return scr.script;
			}
		}
	},
	/**
	* Returns a language system table
	* @instance
	* @param {string} [script='DFLT']
	* @param {string} [language='dlft']
	* @param {boolean} create - forces the creation of this langSysTable if it doesn't exist.
	* @return {Object}
	*/
	getLangSysTable: function(script, language, create) {
		var scriptTable = this.getScriptTable(script, create);
		if (scriptTable) {
			if (!language || language === "dflt" || language === "DFLT") return scriptTable.defaultLangSys;
			var pos = searchTag(scriptTable.langSysRecords, language);
			if (pos >= 0) return scriptTable.langSysRecords[pos].langSys;
			else if (create) {
				var langSysRecord = {
					tag: language,
					langSys: {
						reserved: 0,
						reqFeatureIndex: 65535,
						featureIndexes: []
					}
				};
				scriptTable.langSysRecords.splice(-1 - pos, 0, langSysRecord);
				return langSysRecord.langSys;
			}
		}
	},
	/**
	* Get a specific feature table.
	* @instance
	* @param {string} [script='DFLT']
	* @param {string} [language='dlft']
	* @param {string} feature - One of the codes listed at https://www.microsoft.com/typography/OTSPEC/featurelist.htm
	* @param {boolean} create - forces the creation of the feature table if it doesn't exist.
	* @return {Object}
	*/
	getFeatureTable: function(script, language, feature, create) {
		var langSysTable = this.getLangSysTable(script, language, create);
		if (langSysTable) {
			var featureRecord;
			var featIndexes = langSysTable.featureIndexes;
			var allFeatures = this.font.tables[this.tableName].features;
			for (var i = 0; i < featIndexes.length; i++) {
				featureRecord = allFeatures[featIndexes[i]];
				if (featureRecord.tag === feature) return featureRecord.feature;
			}
			if (create) {
				var index = allFeatures.length;
				check.assert(index === 0 || feature >= allFeatures[index - 1].tag, "Features must be added in alphabetical order.");
				featureRecord = {
					tag: feature,
					feature: {
						params: 0,
						lookupListIndexes: []
					}
				};
				allFeatures.push(featureRecord);
				featIndexes.push(index);
				return featureRecord.feature;
			}
		}
	},
	/**
	* Get the lookup tables of a given type for a script/language/feature.
	* @instance
	* @param {string} [script='DFLT']
	* @param {string} [language='dlft']
	* @param {string} feature - 4-letter feature code
	* @param {number} lookupType - 1 to 9
	* @param {boolean} create - forces the creation of the lookup table if it doesn't exist, with no subtables.
	* @return {Object[]}
	*/
	getLookupTables: function(script, language, feature, lookupType, create) {
		var featureTable = this.getFeatureTable(script, language, feature, create);
		var tables = [];
		if (featureTable) {
			var lookupTable;
			var lookupListIndexes = featureTable.lookupListIndexes;
			var allLookups = this.font.tables[this.tableName].lookups;
			for (var i = 0; i < lookupListIndexes.length; i++) {
				lookupTable = allLookups[lookupListIndexes[i]];
				if (lookupTable.lookupType === lookupType) tables.push(lookupTable);
			}
			if (tables.length === 0 && create) {
				lookupTable = {
					lookupType,
					lookupFlag: 0,
					subtables: [],
					markFilteringSet: void 0
				};
				var index = allLookups.length;
				allLookups.push(lookupTable);
				lookupListIndexes.push(index);
				return [lookupTable];
			}
		}
		return tables;
	},
	/**
	* Find a glyph in a class definition table
	* https://docs.microsoft.com/en-us/typography/opentype/spec/chapter2#class-definition-table
	* @param {object} classDefTable - an OpenType Layout class definition table
	* @param {number} glyphIndex - the index of the glyph to find
	* @returns {number} -1 if not found
	*/
	getGlyphClass: function(classDefTable, glyphIndex) {
		switch (classDefTable.format) {
			case 1:
				if (classDefTable.startGlyph <= glyphIndex && glyphIndex < classDefTable.startGlyph + classDefTable.classes.length) return classDefTable.classes[glyphIndex - classDefTable.startGlyph];
				return 0;
			case 2:
				var range = searchRange(classDefTable.ranges, glyphIndex);
				return range ? range.classId : 0;
		}
	},
	/**
	* Find a glyph in a coverage table
	* https://docs.microsoft.com/en-us/typography/opentype/spec/chapter2#coverage-table
	* @param {object} coverageTable - an OpenType Layout coverage table
	* @param {number} glyphIndex - the index of the glyph to find
	* @returns {number} -1 if not found
	*/
	getCoverageIndex: function(coverageTable, glyphIndex) {
		switch (coverageTable.format) {
			case 1:
				var index = binSearch(coverageTable.glyphs, glyphIndex);
				return index >= 0 ? index : -1;
			case 2:
				var range = searchRange(coverageTable.ranges, glyphIndex);
				return range ? range.index + glyphIndex - range.start : -1;
		}
	},
	/**
	* Returns the list of glyph indexes of a coverage table.
	* Format 1: the list is stored raw
	* Format 2: compact list as range records.
	* @instance
	* @param  {Object} coverageTable
	* @return {Array}
	*/
	expandCoverage: function(coverageTable) {
		if (coverageTable.format === 1) return coverageTable.glyphs;
		else {
			var glyphs = [];
			var ranges = coverageTable.ranges;
			for (var i = 0; i < ranges.length; i++) {
				var range = ranges[i];
				var start = range.start;
				var end = range.end;
				for (var j = start; j <= end; j++) glyphs.push(j);
			}
			return glyphs;
		}
	}
};
/**
* @exports opentype.Position
* @class
* @extends opentype.Layout
* @param {opentype.Font}
* @constructor
*/
function Position(font) {
	Layout.call(this, font, "gpos");
}
Position.prototype = Layout.prototype;
/**
* Init some data for faster and easier access later.
*/
Position.prototype.init = function() {
	var script = this.getDefaultScriptName();
	this.defaultKerningTables = this.getKerningTables(script);
};
/**
* Find a glyph pair in a list of lookup tables of type 2 and retrieve the xAdvance kerning value.
*
* @param {integer} leftIndex - left glyph index
* @param {integer} rightIndex - right glyph index
* @returns {integer}
*/
Position.prototype.getKerningValue = function(kerningLookups, leftIndex, rightIndex) {
	for (var i = 0; i < kerningLookups.length; i++) {
		var subtables = kerningLookups[i].subtables;
		for (var j = 0; j < subtables.length; j++) {
			var subtable = subtables[j];
			var covIndex = this.getCoverageIndex(subtable.coverage, leftIndex);
			if (covIndex < 0) continue;
			switch (subtable.posFormat) {
				case 1:
					var pairSet = subtable.pairSets[covIndex];
					for (var k = 0; k < pairSet.length; k++) {
						var pair = pairSet[k];
						if (pair.secondGlyph === rightIndex) return pair.value1 && pair.value1.xAdvance || 0;
					}
					break;
				case 2:
					var class1 = this.getGlyphClass(subtable.classDef1, leftIndex);
					var class2 = this.getGlyphClass(subtable.classDef2, rightIndex);
					var pair$1 = subtable.classRecords[class1][class2];
					return pair$1.value1 && pair$1.value1.xAdvance || 0;
			}
		}
	}
	return 0;
};
/**
* List all kerning lookup tables.
*
* @param {string} [script='DFLT'] - use font.position.getDefaultScriptName() for a better default value
* @param {string} [language='dflt']
* @return {object[]} The list of kerning lookup tables (may be empty), or undefined if there is no GPOS table (and we should use the kern table)
*/
Position.prototype.getKerningTables = function(script, language) {
	if (this.font.tables.gpos) return this.getLookupTables(script, language, "kern", 2);
};
/**
* @exports opentype.Substitution
* @class
* @extends opentype.Layout
* @param {opentype.Font}
* @constructor
*/
function Substitution(font) {
	Layout.call(this, font, "gsub");
}
function arraysEqual(ar1, ar2) {
	var n = ar1.length;
	if (n !== ar2.length) return false;
	for (var i = 0; i < n; i++) if (ar1[i] !== ar2[i]) return false;
	return true;
}
function getSubstFormat(lookupTable, format, defaultSubtable) {
	var subtables = lookupTable.subtables;
	for (var i = 0; i < subtables.length; i++) {
		var subtable = subtables[i];
		if (subtable.substFormat === format) return subtable;
	}
	if (defaultSubtable) {
		subtables.push(defaultSubtable);
		return defaultSubtable;
	}
}
Substitution.prototype = Layout.prototype;
/**
* Create a default GSUB table.
* @return {Object} gsub - The GSUB table.
*/
Substitution.prototype.createDefaultTable = function() {
	return {
		version: 1,
		scripts: [{
			tag: "DFLT",
			script: {
				defaultLangSys: {
					reserved: 0,
					reqFeatureIndex: 65535,
					featureIndexes: []
				},
				langSysRecords: []
			}
		}],
		features: [],
		lookups: []
	};
};
/**
* List all single substitutions (lookup type 1) for a given script, language, and feature.
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
* @param {string} feature - 4-character feature name ('aalt', 'salt', 'ss01'...)
* @return {Array} substitutions - The list of substitutions.
*/
Substitution.prototype.getSingle = function(feature, script, language) {
	var substitutions = [];
	var lookupTables = this.getLookupTables(script, language, feature, 1);
	for (var idx = 0; idx < lookupTables.length; idx++) {
		var subtables = lookupTables[idx].subtables;
		for (var i = 0; i < subtables.length; i++) {
			var subtable = subtables[i];
			var glyphs = this.expandCoverage(subtable.coverage);
			var j = void 0;
			if (subtable.substFormat === 1) {
				var delta = subtable.deltaGlyphId;
				for (j = 0; j < glyphs.length; j++) {
					var glyph = glyphs[j];
					substitutions.push({
						sub: glyph,
						by: glyph + delta
					});
				}
			} else {
				var substitute = subtable.substitute;
				for (j = 0; j < glyphs.length; j++) substitutions.push({
					sub: glyphs[j],
					by: substitute[j]
				});
			}
		}
	}
	return substitutions;
};
/**
* List all multiple substitutions (lookup type 2) for a given script, language, and feature.
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
* @param {string} feature - 4-character feature name ('ccmp', 'stch')
* @return {Array} substitutions - The list of substitutions.
*/
Substitution.prototype.getMultiple = function(feature, script, language) {
	var substitutions = [];
	var lookupTables = this.getLookupTables(script, language, feature, 2);
	for (var idx = 0; idx < lookupTables.length; idx++) {
		var subtables = lookupTables[idx].subtables;
		for (var i = 0; i < subtables.length; i++) {
			var subtable = subtables[i];
			var glyphs = this.expandCoverage(subtable.coverage);
			var j = void 0;
			for (j = 0; j < glyphs.length; j++) {
				var glyph = glyphs[j];
				var replacements = subtable.sequences[j];
				substitutions.push({
					sub: glyph,
					by: replacements
				});
			}
		}
	}
	return substitutions;
};
/**
* List all alternates (lookup type 3) for a given script, language, and feature.
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
* @param {string} feature - 4-character feature name ('aalt', 'salt'...)
* @return {Array} alternates - The list of alternates
*/
Substitution.prototype.getAlternates = function(feature, script, language) {
	var alternates = [];
	var lookupTables = this.getLookupTables(script, language, feature, 3);
	for (var idx = 0; idx < lookupTables.length; idx++) {
		var subtables = lookupTables[idx].subtables;
		for (var i = 0; i < subtables.length; i++) {
			var subtable = subtables[i];
			var glyphs = this.expandCoverage(subtable.coverage);
			var alternateSets = subtable.alternateSets;
			for (var j = 0; j < glyphs.length; j++) alternates.push({
				sub: glyphs[j],
				by: alternateSets[j]
			});
		}
	}
	return alternates;
};
/**
* List all ligatures (lookup type 4) for a given script, language, and feature.
* The result is an array of ligature objects like { sub: [ids], by: id }
* @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
* @return {Array} ligatures - The list of ligatures.
*/
Substitution.prototype.getLigatures = function(feature, script, language) {
	var ligatures = [];
	var lookupTables = this.getLookupTables(script, language, feature, 4);
	for (var idx = 0; idx < lookupTables.length; idx++) {
		var subtables = lookupTables[idx].subtables;
		for (var i = 0; i < subtables.length; i++) {
			var subtable = subtables[i];
			var glyphs = this.expandCoverage(subtable.coverage);
			var ligatureSets = subtable.ligatureSets;
			for (var j = 0; j < glyphs.length; j++) {
				var startGlyph = glyphs[j];
				var ligSet = ligatureSets[j];
				for (var k = 0; k < ligSet.length; k++) {
					var lig = ligSet[k];
					ligatures.push({
						sub: [startGlyph].concat(lig.components),
						by: lig.ligGlyph
					});
				}
			}
		}
	}
	return ligatures;
};
/**
* Add or modify a single substitution (lookup type 1)
* Format 2, more flexible, is always used.
* @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
* @param {Object} substitution - { sub: id, by: id } (format 1 is not supported)
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
*/
Substitution.prototype.addSingle = function(feature, substitution, script, language) {
	var lookupTable = this.getLookupTables(script, language, feature, 1, true)[0];
	var subtable = getSubstFormat(lookupTable, 2, {
		substFormat: 2,
		coverage: {
			format: 1,
			glyphs: []
		},
		substitute: []
	});
	check.assert(subtable.coverage.format === 1, "Single: unable to modify coverage table format " + subtable.coverage.format);
	var coverageGlyph = substitution.sub;
	var pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
	if (pos < 0) {
		pos = -1 - pos;
		subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
		subtable.substitute.splice(pos, 0, 0);
	}
	subtable.substitute[pos] = substitution.by;
};
/**
* Add or modify a multiple substitution (lookup type 2)
* @param {string} feature - 4-letter feature name ('ccmp', 'stch')
* @param {Object} substitution - { sub: id, by: [id] } for format 2.
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
*/
Substitution.prototype.addMultiple = function(feature, substitution, script, language) {
	check.assert(substitution.by instanceof Array && substitution.by.length > 1, "Multiple: \"by\" must be an array of two or more ids");
	var lookupTable = this.getLookupTables(script, language, feature, 2, true)[0];
	var subtable = getSubstFormat(lookupTable, 1, {
		substFormat: 1,
		coverage: {
			format: 1,
			glyphs: []
		},
		sequences: []
	});
	check.assert(subtable.coverage.format === 1, "Multiple: unable to modify coverage table format " + subtable.coverage.format);
	var coverageGlyph = substitution.sub;
	var pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
	if (pos < 0) {
		pos = -1 - pos;
		subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
		subtable.sequences.splice(pos, 0, 0);
	}
	subtable.sequences[pos] = substitution.by;
};
/**
* Add or modify an alternate substitution (lookup type 3)
* @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
* @param {Object} substitution - { sub: id, by: [ids] }
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
*/
Substitution.prototype.addAlternate = function(feature, substitution, script, language) {
	var lookupTable = this.getLookupTables(script, language, feature, 3, true)[0];
	var subtable = getSubstFormat(lookupTable, 1, {
		substFormat: 1,
		coverage: {
			format: 1,
			glyphs: []
		},
		alternateSets: []
	});
	check.assert(subtable.coverage.format === 1, "Alternate: unable to modify coverage table format " + subtable.coverage.format);
	var coverageGlyph = substitution.sub;
	var pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
	if (pos < 0) {
		pos = -1 - pos;
		subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
		subtable.alternateSets.splice(pos, 0, 0);
	}
	subtable.alternateSets[pos] = substitution.by;
};
/**
* Add a ligature (lookup type 4)
* Ligatures with more components must be stored ahead of those with fewer components in order to be found
* @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
* @param {Object} ligature - { sub: [ids], by: id }
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
*/
Substitution.prototype.addLigature = function(feature, ligature, script, language) {
	var lookupTable = this.getLookupTables(script, language, feature, 4, true)[0];
	var subtable = lookupTable.subtables[0];
	if (!subtable) {
		subtable = {
			substFormat: 1,
			coverage: {
				format: 1,
				glyphs: []
			},
			ligatureSets: []
		};
		lookupTable.subtables[0] = subtable;
	}
	check.assert(subtable.coverage.format === 1, "Ligature: unable to modify coverage table format " + subtable.coverage.format);
	var coverageGlyph = ligature.sub[0];
	var ligComponents = ligature.sub.slice(1);
	var ligatureTable = {
		ligGlyph: ligature.by,
		components: ligComponents
	};
	var pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
	if (pos >= 0) {
		var ligatureSet = subtable.ligatureSets[pos];
		for (var i = 0; i < ligatureSet.length; i++) if (arraysEqual(ligatureSet[i].components, ligComponents)) return;
		ligatureSet.push(ligatureTable);
	} else {
		pos = -1 - pos;
		subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
		subtable.ligatureSets.splice(pos, 0, [ligatureTable]);
	}
};
/**
* List all feature data for a given script and language.
* @param {string} feature - 4-letter feature name
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
* @return {Array} substitutions - The list of substitutions.
*/
Substitution.prototype.getFeature = function(feature, script, language) {
	if (/ss\d\d/.test(feature)) return this.getSingle(feature, script, language);
	switch (feature) {
		case "aalt":
		case "salt": return this.getSingle(feature, script, language).concat(this.getAlternates(feature, script, language));
		case "dlig":
		case "liga":
		case "rlig": return this.getLigatures(feature, script, language);
		case "ccmp": return this.getMultiple(feature, script, language).concat(this.getLigatures(feature, script, language));
		case "stch": return this.getMultiple(feature, script, language);
	}
};
/**
* Add a substitution to a feature for a given script and language.
* @param {string} feature - 4-letter feature name
* @param {Object} sub - the substitution to add (an object like { sub: id or [ids], by: id or [ids] })
* @param {string} [script='DFLT']
* @param {string} [language='dflt']
*/
Substitution.prototype.add = function(feature, sub, script, language) {
	if (/ss\d\d/.test(feature)) return this.addSingle(feature, sub, script, language);
	switch (feature) {
		case "aalt":
		case "salt":
			if (typeof sub.by === "number") return this.addSingle(feature, sub, script, language);
			return this.addAlternate(feature, sub, script, language);
		case "dlig":
		case "liga":
		case "rlig": return this.addLigature(feature, sub, script, language);
		case "ccmp":
			if (sub.by instanceof Array) return this.addMultiple(feature, sub, script, language);
			return this.addLigature(feature, sub, script, language);
	}
};
function checkArgument(expression, message) {
	if (!expression) throw message;
}
function getByte(dataView, offset) {
	return dataView.getUint8(offset);
}
function getUShort(dataView, offset) {
	return dataView.getUint16(offset, false);
}
function getShort(dataView, offset) {
	return dataView.getInt16(offset, false);
}
function getULong(dataView, offset) {
	return dataView.getUint32(offset, false);
}
function getFixed(dataView, offset) {
	return dataView.getInt16(offset, false) + dataView.getUint16(offset + 2, false) / 65535;
}
function getTag(dataView, offset) {
	var tag = "";
	for (var i = offset; i < offset + 4; i += 1) tag += String.fromCharCode(dataView.getInt8(i));
	return tag;
}
function getOffset(dataView, offset, offSize) {
	var v = 0;
	for (var i = 0; i < offSize; i += 1) {
		v <<= 8;
		v += dataView.getUint8(offset + i);
	}
	return v;
}
function getBytes(dataView, startOffset, endOffset) {
	var bytes = [];
	for (var i = startOffset; i < endOffset; i += 1) bytes.push(dataView.getUint8(i));
	return bytes;
}
function bytesToString(bytes) {
	var s = "";
	for (var i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
	return s;
}
var typeOffsets = {
	byte: 1,
	uShort: 2,
	short: 2,
	uLong: 4,
	fixed: 4,
	longDateTime: 8,
	tag: 4
};
function Parser(data, offset) {
	this.data = data;
	this.offset = offset;
	this.relativeOffset = 0;
}
Parser.prototype.parseByte = function() {
	var v = this.data.getUint8(this.offset + this.relativeOffset);
	this.relativeOffset += 1;
	return v;
};
Parser.prototype.parseChar = function() {
	var v = this.data.getInt8(this.offset + this.relativeOffset);
	this.relativeOffset += 1;
	return v;
};
Parser.prototype.parseCard8 = Parser.prototype.parseByte;
Parser.prototype.parseUShort = function() {
	var v = this.data.getUint16(this.offset + this.relativeOffset);
	this.relativeOffset += 2;
	return v;
};
Parser.prototype.parseCard16 = Parser.prototype.parseUShort;
Parser.prototype.parseSID = Parser.prototype.parseUShort;
Parser.prototype.parseOffset16 = Parser.prototype.parseUShort;
Parser.prototype.parseShort = function() {
	var v = this.data.getInt16(this.offset + this.relativeOffset);
	this.relativeOffset += 2;
	return v;
};
Parser.prototype.parseF2Dot14 = function() {
	var v = this.data.getInt16(this.offset + this.relativeOffset) / 16384;
	this.relativeOffset += 2;
	return v;
};
Parser.prototype.parseULong = function() {
	var v = getULong(this.data, this.offset + this.relativeOffset);
	this.relativeOffset += 4;
	return v;
};
Parser.prototype.parseOffset32 = Parser.prototype.parseULong;
Parser.prototype.parseFixed = function() {
	var v = getFixed(this.data, this.offset + this.relativeOffset);
	this.relativeOffset += 4;
	return v;
};
Parser.prototype.parseString = function(length) {
	var dataView = this.data;
	var offset = this.offset + this.relativeOffset;
	var string = "";
	this.relativeOffset += length;
	for (var i = 0; i < length; i++) string += String.fromCharCode(dataView.getUint8(offset + i));
	return string;
};
Parser.prototype.parseTag = function() {
	return this.parseString(4);
};
Parser.prototype.parseLongDateTime = function() {
	var v = getULong(this.data, this.offset + this.relativeOffset + 4);
	v -= 2082844800;
	this.relativeOffset += 8;
	return v;
};
Parser.prototype.parseVersion = function(minorBase) {
	var major = getUShort(this.data, this.offset + this.relativeOffset);
	var minor = getUShort(this.data, this.offset + this.relativeOffset + 2);
	this.relativeOffset += 4;
	if (minorBase === void 0) minorBase = 4096;
	return major + minor / minorBase / 10;
};
Parser.prototype.skip = function(type, amount) {
	if (amount === void 0) amount = 1;
	this.relativeOffset += typeOffsets[type] * amount;
};
Parser.prototype.parseULongList = function(count) {
	if (count === void 0) count = this.parseULong();
	var offsets = new Array(count);
	var dataView = this.data;
	var offset = this.offset + this.relativeOffset;
	for (var i = 0; i < count; i++) {
		offsets[i] = dataView.getUint32(offset);
		offset += 4;
	}
	this.relativeOffset += count * 4;
	return offsets;
};
Parser.prototype.parseOffset16List = Parser.prototype.parseUShortList = function(count) {
	if (count === void 0) count = this.parseUShort();
	var offsets = new Array(count);
	var dataView = this.data;
	var offset = this.offset + this.relativeOffset;
	for (var i = 0; i < count; i++) {
		offsets[i] = dataView.getUint16(offset);
		offset += 2;
	}
	this.relativeOffset += count * 2;
	return offsets;
};
Parser.prototype.parseShortList = function(count) {
	var list = new Array(count);
	var dataView = this.data;
	var offset = this.offset + this.relativeOffset;
	for (var i = 0; i < count; i++) {
		list[i] = dataView.getInt16(offset);
		offset += 2;
	}
	this.relativeOffset += count * 2;
	return list;
};
Parser.prototype.parseByteList = function(count) {
	var list = new Array(count);
	var dataView = this.data;
	var offset = this.offset + this.relativeOffset;
	for (var i = 0; i < count; i++) list[i] = dataView.getUint8(offset++);
	this.relativeOffset += count;
	return list;
};
/**
* Parse a list of items.
* Record count is optional, if omitted it is read from the stream.
* itemCallback is one of the Parser methods.
*/
Parser.prototype.parseList = function(count, itemCallback) {
	if (!itemCallback) {
		itemCallback = count;
		count = this.parseUShort();
	}
	var list = new Array(count);
	for (var i = 0; i < count; i++) list[i] = itemCallback.call(this);
	return list;
};
Parser.prototype.parseList32 = function(count, itemCallback) {
	if (!itemCallback) {
		itemCallback = count;
		count = this.parseULong();
	}
	var list = new Array(count);
	for (var i = 0; i < count; i++) list[i] = itemCallback.call(this);
	return list;
};
/**
* Parse a list of records.
* Record count is optional, if omitted it is read from the stream.
* Example of recordDescription: { sequenceIndex: Parser.uShort, lookupListIndex: Parser.uShort }
*/
Parser.prototype.parseRecordList = function(count, recordDescription) {
	if (!recordDescription) {
		recordDescription = count;
		count = this.parseUShort();
	}
	var records = new Array(count);
	var fields = Object.keys(recordDescription);
	for (var i = 0; i < count; i++) {
		var rec = {};
		for (var j = 0; j < fields.length; j++) {
			var fieldName = fields[j];
			rec[fieldName] = recordDescription[fieldName].call(this);
		}
		records[i] = rec;
	}
	return records;
};
Parser.prototype.parseRecordList32 = function(count, recordDescription) {
	if (!recordDescription) {
		recordDescription = count;
		count = this.parseULong();
	}
	var records = new Array(count);
	var fields = Object.keys(recordDescription);
	for (var i = 0; i < count; i++) {
		var rec = {};
		for (var j = 0; j < fields.length; j++) {
			var fieldName = fields[j];
			rec[fieldName] = recordDescription[fieldName].call(this);
		}
		records[i] = rec;
	}
	return records;
};
Parser.prototype.parseStruct = function(description) {
	if (typeof description === "function") return description.call(this);
	else {
		var fields = Object.keys(description);
		var struct = {};
		for (var j = 0; j < fields.length; j++) {
			var fieldName = fields[j];
			struct[fieldName] = description[fieldName].call(this);
		}
		return struct;
	}
};
/**
* Parse a GPOS valueRecord
* https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#value-record
* valueFormat is optional, if omitted it is read from the stream.
*/
Parser.prototype.parseValueRecord = function(valueFormat) {
	if (valueFormat === void 0) valueFormat = this.parseUShort();
	if (valueFormat === 0) return;
	var valueRecord = {};
	if (valueFormat & 1) valueRecord.xPlacement = this.parseShort();
	if (valueFormat & 2) valueRecord.yPlacement = this.parseShort();
	if (valueFormat & 4) valueRecord.xAdvance = this.parseShort();
	if (valueFormat & 8) valueRecord.yAdvance = this.parseShort();
	if (valueFormat & 16) {
		valueRecord.xPlaDevice = void 0;
		this.parseShort();
	}
	if (valueFormat & 32) {
		valueRecord.yPlaDevice = void 0;
		this.parseShort();
	}
	if (valueFormat & 64) {
		valueRecord.xAdvDevice = void 0;
		this.parseShort();
	}
	if (valueFormat & 128) {
		valueRecord.yAdvDevice = void 0;
		this.parseShort();
	}
	return valueRecord;
};
/**
* Parse a list of GPOS valueRecords
* https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#value-record
* valueFormat and valueCount are read from the stream.
*/
Parser.prototype.parseValueRecordList = function() {
	var valueFormat = this.parseUShort();
	var valueCount = this.parseUShort();
	var values = new Array(valueCount);
	for (var i = 0; i < valueCount; i++) values[i] = this.parseValueRecord(valueFormat);
	return values;
};
Parser.prototype.parsePointer = function(description) {
	var structOffset = this.parseOffset16();
	if (structOffset > 0) return new Parser(this.data, this.offset + structOffset).parseStruct(description);
};
Parser.prototype.parsePointer32 = function(description) {
	var structOffset = this.parseOffset32();
	if (structOffset > 0) return new Parser(this.data, this.offset + structOffset).parseStruct(description);
};
/**
* Parse a list of offsets to lists of 16-bit integers,
* or a list of offsets to lists of offsets to any kind of items.
* If itemCallback is not provided, a list of list of UShort is assumed.
* If provided, itemCallback is called on each item and must parse the item.
* See examples in tables/gsub.js
*/
Parser.prototype.parseListOfLists = function(itemCallback) {
	var offsets = this.parseOffset16List();
	var count = offsets.length;
	var relativeOffset = this.relativeOffset;
	var list = new Array(count);
	for (var i = 0; i < count; i++) {
		var start = offsets[i];
		if (start === 0) {
			list[i] = void 0;
			continue;
		}
		this.relativeOffset = start;
		if (itemCallback) {
			var subOffsets = this.parseOffset16List();
			var subList = new Array(subOffsets.length);
			for (var j = 0; j < subOffsets.length; j++) {
				this.relativeOffset = start + subOffsets[j];
				subList[j] = itemCallback.call(this);
			}
			list[i] = subList;
		} else list[i] = this.parseUShortList();
	}
	this.relativeOffset = relativeOffset;
	return list;
};
Parser.prototype.parseCoverage = function() {
	var startOffset = this.offset + this.relativeOffset;
	var format = this.parseUShort();
	var count = this.parseUShort();
	if (format === 1) return {
		format: 1,
		glyphs: this.parseUShortList(count)
	};
	else if (format === 2) {
		var ranges = new Array(count);
		for (var i = 0; i < count; i++) ranges[i] = {
			start: this.parseUShort(),
			end: this.parseUShort(),
			index: this.parseUShort()
		};
		return {
			format: 2,
			ranges
		};
	}
	throw new Error("0x" + startOffset.toString(16) + ": Coverage format must be 1 or 2.");
};
Parser.prototype.parseClassDef = function() {
	var startOffset = this.offset + this.relativeOffset;
	var format = this.parseUShort();
	if (format === 1) return {
		format: 1,
		startGlyph: this.parseUShort(),
		classes: this.parseUShortList()
	};
	else if (format === 2) return {
		format: 2,
		ranges: this.parseRecordList({
			start: Parser.uShort,
			end: Parser.uShort,
			classId: Parser.uShort
		})
	};
	throw new Error("0x" + startOffset.toString(16) + ": ClassDef format must be 1 or 2.");
};
Parser.list = function(count, itemCallback) {
	return function() {
		return this.parseList(count, itemCallback);
	};
};
Parser.list32 = function(count, itemCallback) {
	return function() {
		return this.parseList32(count, itemCallback);
	};
};
Parser.recordList = function(count, recordDescription) {
	return function() {
		return this.parseRecordList(count, recordDescription);
	};
};
Parser.recordList32 = function(count, recordDescription) {
	return function() {
		return this.parseRecordList32(count, recordDescription);
	};
};
Parser.pointer = function(description) {
	return function() {
		return this.parsePointer(description);
	};
};
Parser.pointer32 = function(description) {
	return function() {
		return this.parsePointer32(description);
	};
};
Parser.tag = Parser.prototype.parseTag;
Parser.byte = Parser.prototype.parseByte;
Parser.uShort = Parser.offset16 = Parser.prototype.parseUShort;
Parser.uShortList = Parser.prototype.parseUShortList;
Parser.uLong = Parser.offset32 = Parser.prototype.parseULong;
Parser.uLongList = Parser.prototype.parseULongList;
Parser.struct = Parser.prototype.parseStruct;
Parser.coverage = Parser.prototype.parseCoverage;
Parser.classDef = Parser.prototype.parseClassDef;
var langSysTable = {
	reserved: Parser.uShort,
	reqFeatureIndex: Parser.uShort,
	featureIndexes: Parser.uShortList
};
Parser.prototype.parseScriptList = function() {
	return this.parsePointer(Parser.recordList({
		tag: Parser.tag,
		script: Parser.pointer({
			defaultLangSys: Parser.pointer(langSysTable),
			langSysRecords: Parser.recordList({
				tag: Parser.tag,
				langSys: Parser.pointer(langSysTable)
			})
		})
	})) || [];
};
Parser.prototype.parseFeatureList = function() {
	return this.parsePointer(Parser.recordList({
		tag: Parser.tag,
		feature: Parser.pointer({
			featureParams: Parser.offset16,
			lookupListIndexes: Parser.uShortList
		})
	})) || [];
};
Parser.prototype.parseLookupList = function(lookupTableParsers) {
	return this.parsePointer(Parser.list(Parser.pointer(function() {
		var lookupType = this.parseUShort();
		check.argument(1 <= lookupType && lookupType <= 9, "GPOS/GSUB lookup type " + lookupType + " unknown.");
		var lookupFlag = this.parseUShort();
		var useMarkFilteringSet = lookupFlag & 16;
		return {
			lookupType,
			lookupFlag,
			subtables: this.parseList(Parser.pointer(lookupTableParsers[lookupType])),
			markFilteringSet: useMarkFilteringSet ? this.parseUShort() : void 0
		};
	}))) || [];
};
Parser.prototype.parseFeatureVariationsList = function() {
	return this.parsePointer32(function() {
		var majorVersion = this.parseUShort();
		var minorVersion = this.parseUShort();
		check.argument(majorVersion === 1 && minorVersion < 1, "GPOS/GSUB feature variations table unknown.");
		return this.parseRecordList32({
			conditionSetOffset: Parser.offset32,
			featureTableSubstitutionOffset: Parser.offset32
		});
	}) || [];
};
var parse = {
	getByte,
	getCard8: getByte,
	getUShort,
	getCard16: getUShort,
	getShort,
	getULong,
	getFixed,
	getTag,
	getOffset,
	getBytes,
	bytesToString,
	Parser
};
function parseGlyphCoordinate(p, flag, previousValue, shortVectorBitMask, sameBitMask) {
	var v;
	if ((flag & shortVectorBitMask) > 0) {
		v = p.parseByte();
		if ((flag & sameBitMask) === 0) v = -v;
		v = previousValue + v;
	} else if ((flag & sameBitMask) > 0) v = previousValue;
	else v = previousValue + p.parseShort();
	return v;
}
function parseGlyph(glyph, data, start) {
	var p = new parse.Parser(data, start);
	glyph.numberOfContours = p.parseShort();
	glyph._xMin = p.parseShort();
	glyph._yMin = p.parseShort();
	glyph._xMax = p.parseShort();
	glyph._yMax = p.parseShort();
	var flags;
	var flag;
	if (glyph.numberOfContours > 0) {
		var endPointIndices = glyph.endPointIndices = [];
		for (var i = 0; i < glyph.numberOfContours; i += 1) endPointIndices.push(p.parseUShort());
		glyph.instructionLength = p.parseUShort();
		glyph.instructions = [];
		for (var i$1 = 0; i$1 < glyph.instructionLength; i$1 += 1) glyph.instructions.push(p.parseByte());
		var numberOfCoordinates = endPointIndices[endPointIndices.length - 1] + 1;
		flags = [];
		for (var i$2 = 0; i$2 < numberOfCoordinates; i$2 += 1) {
			flag = p.parseByte();
			flags.push(flag);
			if ((flag & 8) > 0) {
				var repeatCount = p.parseByte();
				for (var j = 0; j < repeatCount; j += 1) {
					flags.push(flag);
					i$2 += 1;
				}
			}
		}
		check.argument(flags.length === numberOfCoordinates, "Bad flags.");
		if (endPointIndices.length > 0) {
			var points = [];
			var point;
			if (numberOfCoordinates > 0) {
				for (var i$3 = 0; i$3 < numberOfCoordinates; i$3 += 1) {
					flag = flags[i$3];
					point = {};
					point.onCurve = !!(flag & 1);
					point.lastPointOfContour = endPointIndices.indexOf(i$3) >= 0;
					points.push(point);
				}
				var px = 0;
				for (var i$4 = 0; i$4 < numberOfCoordinates; i$4 += 1) {
					flag = flags[i$4];
					point = points[i$4];
					point.x = parseGlyphCoordinate(p, flag, px, 2, 16);
					px = point.x;
				}
				var py = 0;
				for (var i$5 = 0; i$5 < numberOfCoordinates; i$5 += 1) {
					flag = flags[i$5];
					point = points[i$5];
					point.y = parseGlyphCoordinate(p, flag, py, 4, 32);
					py = point.y;
				}
			}
			glyph.points = points;
		} else glyph.points = [];
	} else if (glyph.numberOfContours === 0) glyph.points = [];
	else {
		glyph.isComposite = true;
		glyph.points = [];
		glyph.components = [];
		var moreComponents = true;
		while (moreComponents) {
			flags = p.parseUShort();
			var component = {
				glyphIndex: p.parseUShort(),
				xScale: 1,
				scale01: 0,
				scale10: 0,
				yScale: 1,
				dx: 0,
				dy: 0
			};
			if ((flags & 1) > 0) {
				if ((flags & 2) > 0) {
					component.dx = p.parseShort();
					component.dy = p.parseShort();
				} else component.matchedPoints = [p.parseUShort(), p.parseUShort()];
			} else if ((flags & 2) > 0) {
				component.dx = p.parseChar();
				component.dy = p.parseChar();
			} else component.matchedPoints = [p.parseByte(), p.parseByte()];
			if ((flags & 8) > 0) component.xScale = component.yScale = p.parseF2Dot14();
			else if ((flags & 64) > 0) {
				component.xScale = p.parseF2Dot14();
				component.yScale = p.parseF2Dot14();
			} else if ((flags & 128) > 0) {
				component.xScale = p.parseF2Dot14();
				component.scale01 = p.parseF2Dot14();
				component.scale10 = p.parseF2Dot14();
				component.yScale = p.parseF2Dot14();
			}
			glyph.components.push(component);
			moreComponents = !!(flags & 32);
		}
		if (flags & 256) {
			glyph.instructionLength = p.parseUShort();
			glyph.instructions = [];
			for (var i$6 = 0; i$6 < glyph.instructionLength; i$6 += 1) glyph.instructions.push(p.parseByte());
		}
	}
}
function transformPoints(points, transform) {
	var newPoints = [];
	for (var i = 0; i < points.length; i += 1) {
		var pt = points[i];
		var newPt = {
			x: transform.xScale * pt.x + transform.scale01 * pt.y + transform.dx,
			y: transform.scale10 * pt.x + transform.yScale * pt.y + transform.dy,
			onCurve: pt.onCurve,
			lastPointOfContour: pt.lastPointOfContour
		};
		newPoints.push(newPt);
	}
	return newPoints;
}
function getContours(points) {
	var contours = [];
	var currentContour = [];
	for (var i = 0; i < points.length; i += 1) {
		var pt = points[i];
		currentContour.push(pt);
		if (pt.lastPointOfContour) {
			contours.push(currentContour);
			currentContour = [];
		}
	}
	check.argument(currentContour.length === 0, "There are still points left in the current contour.");
	return contours;
}
function getPath(points) {
	var p = new Path();
	if (!points) return p;
	var contours = getContours(points);
	for (var contourIndex = 0; contourIndex < contours.length; ++contourIndex) {
		var contour = contours[contourIndex];
		var prev = null;
		var curr = contour[contour.length - 1];
		var next = contour[0];
		if (curr.onCurve) p.moveTo(curr.x, curr.y);
		else if (next.onCurve) p.moveTo(next.x, next.y);
		else {
			var start = {
				x: (curr.x + next.x) * .5,
				y: (curr.y + next.y) * .5
			};
			p.moveTo(start.x, start.y);
		}
		for (var i = 0; i < contour.length; ++i) {
			prev = curr;
			curr = next;
			next = contour[(i + 1) % contour.length];
			if (curr.onCurve) p.lineTo(curr.x, curr.y);
			else {
				var next2 = next;
				if (!prev.onCurve) (curr.x + prev.x) * .5, (curr.y + prev.y) * .5;
				if (!next.onCurve) next2 = {
					x: (curr.x + next.x) * .5,
					y: (curr.y + next.y) * .5
				};
				p.quadraticCurveTo(curr.x, curr.y, next2.x, next2.y);
			}
		}
		p.closePath();
	}
	return p;
}
function buildPath(glyphs, glyph) {
	if (glyph.isComposite) for (var j = 0; j < glyph.components.length; j += 1) {
		var component = glyph.components[j];
		var componentGlyph = glyphs.get(component.glyphIndex);
		componentGlyph.getPath();
		if (componentGlyph.points) {
			var transformedPoints = void 0;
			if (component.matchedPoints === void 0) transformedPoints = transformPoints(componentGlyph.points, component);
			else {
				if (component.matchedPoints[0] > glyph.points.length - 1 || component.matchedPoints[1] > componentGlyph.points.length - 1) throw Error("Matched points out of range in " + glyph.name);
				var firstPt = glyph.points[component.matchedPoints[0]];
				var secondPt = componentGlyph.points[component.matchedPoints[1]];
				var transform = {
					xScale: component.xScale,
					scale01: component.scale01,
					scale10: component.scale10,
					yScale: component.yScale,
					dx: 0,
					dy: 0
				};
				secondPt = transformPoints([secondPt], transform)[0];
				transform.dx = firstPt.x - secondPt.x;
				transform.dy = firstPt.y - secondPt.y;
				transformedPoints = transformPoints(componentGlyph.points, transform);
			}
			glyph.points = glyph.points.concat(transformedPoints);
		}
	}
	return getPath(glyph.points);
}
function parseGlyfTableAll(data, start, loca, font) {
	var glyphs = new glyphset.GlyphSet(font);
	for (var i = 0; i < loca.length - 1; i += 1) {
		var offset = loca[i];
		if (offset !== loca[i + 1]) glyphs.push(i, glyphset.ttfGlyphLoader(font, i, parseGlyph, data, start + offset, buildPath));
		else glyphs.push(i, glyphset.glyphLoader(font, i));
	}
	return glyphs;
}
function parseGlyfTableOnLowMemory(data, start, loca, font) {
	var glyphs = new glyphset.GlyphSet(font);
	font._push = function(i) {
		var offset = loca[i];
		if (offset !== loca[i + 1]) glyphs.push(i, glyphset.ttfGlyphLoader(font, i, parseGlyph, data, start + offset, buildPath));
		else glyphs.push(i, glyphset.glyphLoader(font, i));
	};
	return glyphs;
}
function parseGlyfTable(data, start, loca, font, opt) {
	if (opt.lowMemory) return parseGlyfTableOnLowMemory(data, start, loca, font);
	else return parseGlyfTableAll(data, start, loca, font);
}
var glyf = {
	getPath,
	parse: parseGlyfTable
};
var instructionTable;
var exec;
var execGlyph;
var execComponent;
function Hinting(font) {
	this.font = font;
	this.getCommands = function(hPoints) {
		return glyf.getPath(hPoints).commands;
	};
	this._fpgmState = this._prepState = void 0;
	this._errorState = 0;
}
function roundOff(v) {
	return v;
}
function roundToGrid(v) {
	return Math.sign(v) * Math.round(Math.abs(v));
}
function roundToDoubleGrid(v) {
	return Math.sign(v) * Math.round(Math.abs(v * 2)) / 2;
}
function roundToHalfGrid(v) {
	return Math.sign(v) * (Math.round(Math.abs(v) + .5) - .5);
}
function roundUpToGrid(v) {
	return Math.sign(v) * Math.ceil(Math.abs(v));
}
function roundDownToGrid(v) {
	return Math.sign(v) * Math.floor(Math.abs(v));
}
var roundSuper = function(v) {
	var period = this.srPeriod;
	var phase = this.srPhase;
	var threshold = this.srThreshold;
	var sign = 1;
	if (v < 0) {
		v = -v;
		sign = -1;
	}
	v += threshold - phase;
	v = Math.trunc(v / period) * period;
	v += phase;
	if (v < 0) return phase * sign;
	return v * sign;
};
var xUnitVector = {
	x: 1,
	y: 0,
	axis: "x",
	distance: function(p1, p2, o1, o2) {
		return (o1 ? p1.xo : p1.x) - (o2 ? p2.xo : p2.x);
	},
	interpolate: function(p, rp1, rp2, pv) {
		var do1;
		var do2;
		var doa1;
		var doa2;
		var dm1;
		var dm2;
		var dt;
		if (!pv || pv === this) {
			do1 = p.xo - rp1.xo;
			do2 = p.xo - rp2.xo;
			dm1 = rp1.x - rp1.xo;
			dm2 = rp2.x - rp2.xo;
			doa1 = Math.abs(do1);
			doa2 = Math.abs(do2);
			dt = doa1 + doa2;
			if (dt === 0) {
				p.x = p.xo + (dm1 + dm2) / 2;
				return;
			}
			p.x = p.xo + (dm1 * doa2 + dm2 * doa1) / dt;
			return;
		}
		do1 = pv.distance(p, rp1, true, true);
		do2 = pv.distance(p, rp2, true, true);
		dm1 = pv.distance(rp1, rp1, false, true);
		dm2 = pv.distance(rp2, rp2, false, true);
		doa1 = Math.abs(do1);
		doa2 = Math.abs(do2);
		dt = doa1 + doa2;
		if (dt === 0) {
			xUnitVector.setRelative(p, p, (dm1 + dm2) / 2, pv, true);
			return;
		}
		xUnitVector.setRelative(p, p, (dm1 * doa2 + dm2 * doa1) / dt, pv, true);
	},
	normalSlope: Number.NEGATIVE_INFINITY,
	setRelative: function(p, rp, d, pv, org) {
		if (!pv || pv === this) {
			p.x = (org ? rp.xo : rp.x) + d;
			return;
		}
		var rpx = org ? rp.xo : rp.x;
		var rpy = org ? rp.yo : rp.y;
		var rpdx = rpx + d * pv.x;
		var rpdy = rpy + d * pv.y;
		p.x = rpdx + (p.y - rpdy) / pv.normalSlope;
	},
	slope: 0,
	touch: function(p) {
		p.xTouched = true;
	},
	touched: function(p) {
		return p.xTouched;
	},
	untouch: function(p) {
		p.xTouched = false;
	}
};
var yUnitVector = {
	x: 0,
	y: 1,
	axis: "y",
	distance: function(p1, p2, o1, o2) {
		return (o1 ? p1.yo : p1.y) - (o2 ? p2.yo : p2.y);
	},
	interpolate: function(p, rp1, rp2, pv) {
		var do1;
		var do2;
		var doa1;
		var doa2;
		var dm1;
		var dm2;
		var dt;
		if (!pv || pv === this) {
			do1 = p.yo - rp1.yo;
			do2 = p.yo - rp2.yo;
			dm1 = rp1.y - rp1.yo;
			dm2 = rp2.y - rp2.yo;
			doa1 = Math.abs(do1);
			doa2 = Math.abs(do2);
			dt = doa1 + doa2;
			if (dt === 0) {
				p.y = p.yo + (dm1 + dm2) / 2;
				return;
			}
			p.y = p.yo + (dm1 * doa2 + dm2 * doa1) / dt;
			return;
		}
		do1 = pv.distance(p, rp1, true, true);
		do2 = pv.distance(p, rp2, true, true);
		dm1 = pv.distance(rp1, rp1, false, true);
		dm2 = pv.distance(rp2, rp2, false, true);
		doa1 = Math.abs(do1);
		doa2 = Math.abs(do2);
		dt = doa1 + doa2;
		if (dt === 0) {
			yUnitVector.setRelative(p, p, (dm1 + dm2) / 2, pv, true);
			return;
		}
		yUnitVector.setRelative(p, p, (dm1 * doa2 + dm2 * doa1) / dt, pv, true);
	},
	normalSlope: 0,
	setRelative: function(p, rp, d, pv, org) {
		if (!pv || pv === this) {
			p.y = (org ? rp.yo : rp.y) + d;
			return;
		}
		var rpx = org ? rp.xo : rp.x;
		var rpy = org ? rp.yo : rp.y;
		var rpdx = rpx + d * pv.x;
		p.y = rpy + d * pv.y + pv.normalSlope * (p.x - rpdx);
	},
	slope: Number.POSITIVE_INFINITY,
	touch: function(p) {
		p.yTouched = true;
	},
	touched: function(p) {
		return p.yTouched;
	},
	untouch: function(p) {
		p.yTouched = false;
	}
};
Object.freeze(xUnitVector);
Object.freeze(yUnitVector);
function UnitVector(x, y) {
	this.x = x;
	this.y = y;
	this.axis = void 0;
	this.slope = y / x;
	this.normalSlope = -x / y;
	Object.freeze(this);
}
UnitVector.prototype.distance = function(p1, p2, o1, o2) {
	return this.x * xUnitVector.distance(p1, p2, o1, o2) + this.y * yUnitVector.distance(p1, p2, o1, o2);
};
UnitVector.prototype.interpolate = function(p, rp1, rp2, pv) {
	var dm1;
	var dm2;
	var do1;
	var do2;
	var doa1;
	var doa2;
	var dt;
	do1 = pv.distance(p, rp1, true, true);
	do2 = pv.distance(p, rp2, true, true);
	dm1 = pv.distance(rp1, rp1, false, true);
	dm2 = pv.distance(rp2, rp2, false, true);
	doa1 = Math.abs(do1);
	doa2 = Math.abs(do2);
	dt = doa1 + doa2;
	if (dt === 0) {
		this.setRelative(p, p, (dm1 + dm2) / 2, pv, true);
		return;
	}
	this.setRelative(p, p, (dm1 * doa2 + dm2 * doa1) / dt, pv, true);
};
UnitVector.prototype.setRelative = function(p, rp, d, pv, org) {
	pv = pv || this;
	var rpx = org ? rp.xo : rp.x;
	var rpy = org ? rp.yo : rp.y;
	var rpdx = rpx + d * pv.x;
	var rpdy = rpy + d * pv.y;
	var pvns = pv.normalSlope;
	var fvs = this.slope;
	var px = p.x;
	var py = p.y;
	p.x = (fvs * px - pvns * rpdx + rpdy - py) / (fvs - pvns);
	p.y = fvs * (p.x - px) + py;
};
UnitVector.prototype.touch = function(p) {
	p.xTouched = true;
	p.yTouched = true;
};
function getUnitVector(x, y) {
	var d = Math.sqrt(x * x + y * y);
	x /= d;
	y /= d;
	if (x === 1 && y === 0) return xUnitVector;
	else if (x === 0 && y === 1) return yUnitVector;
	else return new UnitVector(x, y);
}
function HPoint(x, y, lastPointOfContour, onCurve) {
	this.x = this.xo = Math.round(x * 64) / 64;
	this.y = this.yo = Math.round(y * 64) / 64;
	this.lastPointOfContour = lastPointOfContour;
	this.onCurve = onCurve;
	this.prevPointOnContour = void 0;
	this.nextPointOnContour = void 0;
	this.xTouched = false;
	this.yTouched = false;
	Object.preventExtensions(this);
}
HPoint.prototype.nextTouched = function(v) {
	var p = this.nextPointOnContour;
	while (!v.touched(p) && p !== this) p = p.nextPointOnContour;
	return p;
};
HPoint.prototype.prevTouched = function(v) {
	var p = this.prevPointOnContour;
	while (!v.touched(p) && p !== this) p = p.prevPointOnContour;
	return p;
};
var HPZero = Object.freeze(new HPoint(0, 0));
var defaultState = {
	cvCutIn: 17 / 16,
	deltaBase: 9,
	deltaShift: .125,
	loop: 1,
	minDis: 1,
	autoFlip: true
};
function State(env, prog) {
	this.env = env;
	this.stack = [];
	this.prog = prog;
	switch (env) {
		case "glyf":
			this.zp0 = this.zp1 = this.zp2 = 1;
			this.rp0 = this.rp1 = this.rp2 = 0;
		case "prep":
			this.fv = this.pv = this.dpv = xUnitVector;
			this.round = roundToGrid;
	}
}
Hinting.prototype.exec = function(glyph, ppem) {
	if (typeof ppem !== "number") throw new Error("Point size is not a number!");
	if (this._errorState > 2) return;
	var font = this.font;
	var prepState = this._prepState;
	if (!prepState || prepState.ppem !== ppem) {
		var fpgmState = this._fpgmState;
		if (!fpgmState) {
			State.prototype = defaultState;
			fpgmState = this._fpgmState = new State("fpgm", font.tables.fpgm);
			fpgmState.funcs = [];
			fpgmState.font = font;
			if (exports.DEBUG) {
				console.log("---EXEC FPGM---");
				fpgmState.step = -1;
			}
			try {
				exec(fpgmState);
			} catch (e) {
				console.log("Hinting error in FPGM:" + e);
				this._errorState = 3;
				return;
			}
		}
		State.prototype = fpgmState;
		prepState = this._prepState = new State("prep", font.tables.prep);
		prepState.ppem = ppem;
		var oCvt = font.tables.cvt;
		if (oCvt) {
			var cvt = prepState.cvt = new Array(oCvt.length);
			var scale = ppem / font.unitsPerEm;
			for (var c = 0; c < oCvt.length; c++) cvt[c] = oCvt[c] * scale;
		} else prepState.cvt = [];
		if (exports.DEBUG) {
			console.log("---EXEC PREP---");
			prepState.step = -1;
		}
		try {
			exec(prepState);
		} catch (e) {
			if (this._errorState < 2) console.log("Hinting error in PREP:" + e);
			this._errorState = 2;
		}
	}
	if (this._errorState > 1) return;
	try {
		return execGlyph(glyph, prepState);
	} catch (e) {
		if (this._errorState < 1) {
			console.log("Hinting error:" + e);
			console.log("Note: further hinting errors are silenced");
		}
		this._errorState = 1;
		return;
	}
};
execGlyph = function(glyph, prepState) {
	var xScale = prepState.ppem / prepState.font.unitsPerEm;
	var yScale = xScale;
	var components = glyph.components;
	var contours;
	var gZone;
	var state;
	State.prototype = prepState;
	if (!components) {
		state = new State("glyf", glyph.instructions);
		if (exports.DEBUG) {
			console.log("---EXEC GLYPH---");
			state.step = -1;
		}
		execComponent(glyph, state, xScale, yScale);
		gZone = state.gZone;
	} else {
		var font = prepState.font;
		gZone = [];
		contours = [];
		for (var i = 0; i < components.length; i++) {
			var c = components[i];
			var cg = font.glyphs.get(c.glyphIndex);
			state = new State("glyf", cg.instructions);
			if (exports.DEBUG) {
				console.log("---EXEC COMP " + i + "---");
				state.step = -1;
			}
			execComponent(cg, state, xScale, yScale);
			var dx = Math.round(c.dx * xScale);
			var dy = Math.round(c.dy * yScale);
			var gz = state.gZone;
			var cc = state.contours;
			for (var pi = 0; pi < gz.length; pi++) {
				var p = gz[pi];
				p.xTouched = p.yTouched = false;
				p.xo = p.x = p.x + dx;
				p.yo = p.y = p.y + dy;
			}
			var gLen = gZone.length;
			gZone.push.apply(gZone, gz);
			for (var j = 0; j < cc.length; j++) contours.push(cc[j] + gLen);
		}
		if (glyph.instructions && !state.inhibitGridFit) {
			state = new State("glyf", glyph.instructions);
			state.gZone = state.z0 = state.z1 = state.z2 = gZone;
			state.contours = contours;
			gZone.push(new HPoint(0, 0), new HPoint(Math.round(glyph.advanceWidth * xScale), 0));
			if (exports.DEBUG) {
				console.log("---EXEC COMPOSITE---");
				state.step = -1;
			}
			exec(state);
			gZone.length -= 2;
		}
	}
	return gZone;
};
execComponent = function(glyph, state, xScale, yScale) {
	var points = glyph.points || [];
	var pLen = points.length;
	var gZone = state.gZone = state.z0 = state.z1 = state.z2 = [];
	var contours = state.contours = [];
	var cp;
	for (var i = 0; i < pLen; i++) {
		cp = points[i];
		gZone[i] = new HPoint(cp.x * xScale, cp.y * yScale, cp.lastPointOfContour, cp.onCurve);
	}
	var sp;
	var np;
	for (var i$1 = 0; i$1 < pLen; i$1++) {
		cp = gZone[i$1];
		if (!sp) {
			sp = cp;
			contours.push(i$1);
		}
		if (cp.lastPointOfContour) {
			cp.nextPointOnContour = sp;
			sp.prevPointOnContour = cp;
			sp = void 0;
		} else {
			np = gZone[i$1 + 1];
			cp.nextPointOnContour = np;
			np.prevPointOnContour = cp;
		}
	}
	if (state.inhibitGridFit) return;
	if (exports.DEBUG) {
		console.log("PROCESSING GLYPH", state.stack);
		for (var i$2 = 0; i$2 < pLen; i$2++) console.log(i$2, gZone[i$2].x, gZone[i$2].y);
	}
	gZone.push(new HPoint(0, 0), new HPoint(Math.round(glyph.advanceWidth * xScale), 0));
	exec(state);
	gZone.length -= 2;
	if (exports.DEBUG) {
		console.log("FINISHED GLYPH", state.stack);
		for (var i$3 = 0; i$3 < pLen; i$3++) console.log(i$3, gZone[i$3].x, gZone[i$3].y);
	}
};
exec = function(state) {
	var prog = state.prog;
	if (!prog) return;
	var pLen = prog.length;
	var ins;
	for (state.ip = 0; state.ip < pLen; state.ip++) {
		if (exports.DEBUG) state.step++;
		ins = instructionTable[prog[state.ip]];
		if (!ins) throw new Error("unknown instruction: 0x" + Number(prog[state.ip]).toString(16));
		ins(state);
	}
};
function initTZone(state) {
	var tZone = state.tZone = new Array(state.gZone.length);
	for (var i = 0; i < tZone.length; i++) tZone[i] = new HPoint(0, 0);
}
function skip(state, handleElse) {
	var prog = state.prog;
	var ip = state.ip;
	var nesting = 1;
	var ins;
	do {
		ins = prog[++ip];
		if (ins === 88) nesting++;
		else if (ins === 89) nesting--;
		else if (ins === 64) ip += prog[ip + 1] + 1;
		else if (ins === 65) ip += 2 * prog[ip + 1] + 1;
		else if (ins >= 176 && ins <= 183) ip += ins - 176 + 1;
		else if (ins >= 184 && ins <= 191) ip += (ins - 184 + 1) * 2;
		else if (handleElse && nesting === 1 && ins === 27) break;
	} while (nesting > 0);
	state.ip = ip;
}
function SVTCA(v, state) {
	if (exports.DEBUG) console.log(state.step, "SVTCA[" + v.axis + "]");
	state.fv = state.pv = state.dpv = v;
}
function SPVTCA(v, state) {
	if (exports.DEBUG) console.log(state.step, "SPVTCA[" + v.axis + "]");
	state.pv = state.dpv = v;
}
function SFVTCA(v, state) {
	if (exports.DEBUG) console.log(state.step, "SFVTCA[" + v.axis + "]");
	state.fv = v;
}
function SPVTL(a, state) {
	var stack = state.stack;
	var p2i = stack.pop();
	var p1i = stack.pop();
	var p2 = state.z2[p2i];
	var p1 = state.z1[p1i];
	if (exports.DEBUG) console.log("SPVTL[" + a + "]", p2i, p1i);
	var dx;
	var dy;
	if (!a) {
		dx = p1.x - p2.x;
		dy = p1.y - p2.y;
	} else {
		dx = p2.y - p1.y;
		dy = p1.x - p2.x;
	}
	state.pv = state.dpv = getUnitVector(dx, dy);
}
function SFVTL(a, state) {
	var stack = state.stack;
	var p2i = stack.pop();
	var p1i = stack.pop();
	var p2 = state.z2[p2i];
	var p1 = state.z1[p1i];
	if (exports.DEBUG) console.log("SFVTL[" + a + "]", p2i, p1i);
	var dx;
	var dy;
	if (!a) {
		dx = p1.x - p2.x;
		dy = p1.y - p2.y;
	} else {
		dx = p2.y - p1.y;
		dy = p1.x - p2.x;
	}
	state.fv = getUnitVector(dx, dy);
}
function SPVFS(state) {
	var stack = state.stack;
	var y = stack.pop();
	var x = stack.pop();
	if (exports.DEBUG) console.log(state.step, "SPVFS[]", y, x);
	state.pv = state.dpv = getUnitVector(x, y);
}
function SFVFS(state) {
	var stack = state.stack;
	var y = stack.pop();
	var x = stack.pop();
	if (exports.DEBUG) console.log(state.step, "SPVFS[]", y, x);
	state.fv = getUnitVector(x, y);
}
function GPV(state) {
	var stack = state.stack;
	var pv = state.pv;
	if (exports.DEBUG) console.log(state.step, "GPV[]");
	stack.push(pv.x * 16384);
	stack.push(pv.y * 16384);
}
function GFV(state) {
	var stack = state.stack;
	var fv = state.fv;
	if (exports.DEBUG) console.log(state.step, "GFV[]");
	stack.push(fv.x * 16384);
	stack.push(fv.y * 16384);
}
function SFVTPV(state) {
	state.fv = state.pv;
	if (exports.DEBUG) console.log(state.step, "SFVTPV[]");
}
function ISECT(state) {
	var stack = state.stack;
	var pa0i = stack.pop();
	var pa1i = stack.pop();
	var pb0i = stack.pop();
	var pb1i = stack.pop();
	var pi = stack.pop();
	var z0 = state.z0;
	var z1 = state.z1;
	var pa0 = z0[pa0i];
	var pa1 = z0[pa1i];
	var pb0 = z1[pb0i];
	var pb1 = z1[pb1i];
	var p = state.z2[pi];
	if (exports.DEBUG) console.log("ISECT[], ", pa0i, pa1i, pb0i, pb1i, pi);
	var x1 = pa0.x;
	var y1 = pa0.y;
	var x2 = pa1.x;
	var y2 = pa1.y;
	var x3 = pb0.x;
	var y3 = pb0.y;
	var x4 = pb1.x;
	var y4 = pb1.y;
	var div = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
	var f1 = x1 * y2 - y1 * x2;
	var f2 = x3 * y4 - y3 * x4;
	p.x = (f1 * (x3 - x4) - f2 * (x1 - x2)) / div;
	p.y = (f1 * (y3 - y4) - f2 * (y1 - y2)) / div;
}
function SRP0(state) {
	state.rp0 = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SRP0[]", state.rp0);
}
function SRP1(state) {
	state.rp1 = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SRP1[]", state.rp1);
}
function SRP2(state) {
	state.rp2 = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SRP2[]", state.rp2);
}
function SZP0(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SZP0[]", n);
	state.zp0 = n;
	switch (n) {
		case 0:
			if (!state.tZone) initTZone(state);
			state.z0 = state.tZone;
			break;
		case 1:
			state.z0 = state.gZone;
			break;
		default: throw new Error("Invalid zone pointer");
	}
}
function SZP1(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SZP1[]", n);
	state.zp1 = n;
	switch (n) {
		case 0:
			if (!state.tZone) initTZone(state);
			state.z1 = state.tZone;
			break;
		case 1:
			state.z1 = state.gZone;
			break;
		default: throw new Error("Invalid zone pointer");
	}
}
function SZP2(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SZP2[]", n);
	state.zp2 = n;
	switch (n) {
		case 0:
			if (!state.tZone) initTZone(state);
			state.z2 = state.tZone;
			break;
		case 1:
			state.z2 = state.gZone;
			break;
		default: throw new Error("Invalid zone pointer");
	}
}
function SZPS(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SZPS[]", n);
	state.zp0 = state.zp1 = state.zp2 = n;
	switch (n) {
		case 0:
			if (!state.tZone) initTZone(state);
			state.z0 = state.z1 = state.z2 = state.tZone;
			break;
		case 1:
			state.z0 = state.z1 = state.z2 = state.gZone;
			break;
		default: throw new Error("Invalid zone pointer");
	}
}
function SLOOP(state) {
	state.loop = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SLOOP[]", state.loop);
}
function RTG(state) {
	if (exports.DEBUG) console.log(state.step, "RTG[]");
	state.round = roundToGrid;
}
function RTHG(state) {
	if (exports.DEBUG) console.log(state.step, "RTHG[]");
	state.round = roundToHalfGrid;
}
function SMD(state) {
	var d = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SMD[]", d);
	state.minDis = d / 64;
}
function ELSE(state) {
	if (exports.DEBUG) console.log(state.step, "ELSE[]");
	skip(state, false);
}
function JMPR(state) {
	var o = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "JMPR[]", o);
	state.ip += o - 1;
}
function SCVTCI(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SCVTCI[]", n);
	state.cvCutIn = n / 64;
}
function DUP(state) {
	var stack = state.stack;
	if (exports.DEBUG) console.log(state.step, "DUP[]");
	stack.push(stack[stack.length - 1]);
}
function POP(state) {
	if (exports.DEBUG) console.log(state.step, "POP[]");
	state.stack.pop();
}
function CLEAR(state) {
	if (exports.DEBUG) console.log(state.step, "CLEAR[]");
	state.stack.length = 0;
}
function SWAP(state) {
	var stack = state.stack;
	var a = stack.pop();
	var b = stack.pop();
	if (exports.DEBUG) console.log(state.step, "SWAP[]");
	stack.push(a);
	stack.push(b);
}
function DEPTH(state) {
	var stack = state.stack;
	if (exports.DEBUG) console.log(state.step, "DEPTH[]");
	stack.push(stack.length);
}
function LOOPCALL(state) {
	var stack = state.stack;
	var fn = stack.pop();
	var c = stack.pop();
	if (exports.DEBUG) console.log(state.step, "LOOPCALL[]", fn, c);
	var cip = state.ip;
	var cprog = state.prog;
	state.prog = state.funcs[fn];
	for (var i = 0; i < c; i++) {
		exec(state);
		if (exports.DEBUG) console.log(++state.step, i + 1 < c ? "next loopcall" : "done loopcall", i);
	}
	state.ip = cip;
	state.prog = cprog;
}
function CALL(state) {
	var fn = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "CALL[]", fn);
	var cip = state.ip;
	var cprog = state.prog;
	state.prog = state.funcs[fn];
	exec(state);
	state.ip = cip;
	state.prog = cprog;
	if (exports.DEBUG) console.log(++state.step, "returning from", fn);
}
function CINDEX(state) {
	var stack = state.stack;
	var k = stack.pop();
	if (exports.DEBUG) console.log(state.step, "CINDEX[]", k);
	stack.push(stack[stack.length - k]);
}
function MINDEX(state) {
	var stack = state.stack;
	var k = stack.pop();
	if (exports.DEBUG) console.log(state.step, "MINDEX[]", k);
	stack.push(stack.splice(stack.length - k, 1)[0]);
}
function FDEF(state) {
	if (state.env !== "fpgm") throw new Error("FDEF not allowed here");
	var stack = state.stack;
	var prog = state.prog;
	var ip = state.ip;
	var fn = stack.pop();
	var ipBegin = ip;
	if (exports.DEBUG) console.log(state.step, "FDEF[]", fn);
	while (prog[++ip] !== 45);
	state.ip = ip;
	state.funcs[fn] = prog.slice(ipBegin + 1, ip);
}
function MDAP(round, state) {
	var pi = state.stack.pop();
	var p = state.z0[pi];
	var fv = state.fv;
	var pv = state.pv;
	if (exports.DEBUG) console.log(state.step, "MDAP[" + round + "]", pi);
	var d = pv.distance(p, HPZero);
	if (round) d = state.round(d);
	fv.setRelative(p, HPZero, d, pv);
	fv.touch(p);
	state.rp0 = state.rp1 = pi;
}
function IUP(v, state) {
	var z2 = state.z2;
	var pLen = z2.length - 2;
	var cp;
	var pp;
	var np;
	if (exports.DEBUG) console.log(state.step, "IUP[" + v.axis + "]");
	for (var i = 0; i < pLen; i++) {
		cp = z2[i];
		if (v.touched(cp)) continue;
		pp = cp.prevTouched(v);
		if (pp === cp) continue;
		np = cp.nextTouched(v);
		if (pp === np) v.setRelative(cp, cp, v.distance(pp, pp, false, true), v, true);
		v.interpolate(cp, pp, np, v);
	}
}
function SHP(a, state) {
	var stack = state.stack;
	var rpi = a ? state.rp1 : state.rp2;
	var rp = (a ? state.z0 : state.z1)[rpi];
	var fv = state.fv;
	var pv = state.pv;
	var loop = state.loop;
	var z2 = state.z2;
	while (loop--) {
		var pi = stack.pop();
		var p = z2[pi];
		var d = pv.distance(rp, rp, false, true);
		fv.setRelative(p, p, d, pv);
		fv.touch(p);
		if (exports.DEBUG) console.log(state.step, (state.loop > 1 ? "loop " + (state.loop - loop) + ": " : "") + "SHP[" + (a ? "rp1" : "rp2") + "]", pi);
	}
	state.loop = 1;
}
function SHC(a, state) {
	var stack = state.stack;
	var rpi = a ? state.rp1 : state.rp2;
	var rp = (a ? state.z0 : state.z1)[rpi];
	var fv = state.fv;
	var pv = state.pv;
	var ci = stack.pop();
	var sp = state.z2[state.contours[ci]];
	var p = sp;
	if (exports.DEBUG) console.log(state.step, "SHC[" + a + "]", ci);
	var d = pv.distance(rp, rp, false, true);
	do {
		if (p !== rp) fv.setRelative(p, p, d, pv);
		p = p.nextPointOnContour;
	} while (p !== sp);
}
function SHZ(a, state) {
	var stack = state.stack;
	var rpi = a ? state.rp1 : state.rp2;
	var rp = (a ? state.z0 : state.z1)[rpi];
	var fv = state.fv;
	var pv = state.pv;
	var e = stack.pop();
	if (exports.DEBUG) console.log(state.step, "SHZ[" + a + "]", e);
	var z;
	switch (e) {
		case 0:
			z = state.tZone;
			break;
		case 1:
			z = state.gZone;
			break;
		default: throw new Error("Invalid zone");
	}
	var p;
	var d = pv.distance(rp, rp, false, true);
	var pLen = z.length - 2;
	for (var i = 0; i < pLen; i++) {
		p = z[i];
		fv.setRelative(p, p, d, pv);
	}
}
function SHPIX(state) {
	var stack = state.stack;
	var loop = state.loop;
	var fv = state.fv;
	var d = stack.pop() / 64;
	var z2 = state.z2;
	while (loop--) {
		var pi = stack.pop();
		var p = z2[pi];
		if (exports.DEBUG) console.log(state.step, (state.loop > 1 ? "loop " + (state.loop - loop) + ": " : "") + "SHPIX[]", pi, d);
		fv.setRelative(p, p, d);
		fv.touch(p);
	}
	state.loop = 1;
}
function IP(state) {
	var stack = state.stack;
	var rp1i = state.rp1;
	var rp2i = state.rp2;
	var loop = state.loop;
	var rp1 = state.z0[rp1i];
	var rp2 = state.z1[rp2i];
	var fv = state.fv;
	var pv = state.dpv;
	var z2 = state.z2;
	while (loop--) {
		var pi = stack.pop();
		var p = z2[pi];
		if (exports.DEBUG) console.log(state.step, (state.loop > 1 ? "loop " + (state.loop - loop) + ": " : "") + "IP[]", pi, rp1i, "<->", rp2i);
		fv.interpolate(p, rp1, rp2, pv);
		fv.touch(p);
	}
	state.loop = 1;
}
function MSIRP(a, state) {
	var stack = state.stack;
	var d = stack.pop() / 64;
	var pi = stack.pop();
	var p = state.z1[pi];
	var rp0 = state.z0[state.rp0];
	var fv = state.fv;
	var pv = state.pv;
	fv.setRelative(p, rp0, d, pv);
	fv.touch(p);
	if (exports.DEBUG) console.log(state.step, "MSIRP[" + a + "]", d, pi);
	state.rp1 = state.rp0;
	state.rp2 = pi;
	if (a) state.rp0 = pi;
}
function ALIGNRP(state) {
	var stack = state.stack;
	var rp0i = state.rp0;
	var rp0 = state.z0[rp0i];
	var loop = state.loop;
	var fv = state.fv;
	var pv = state.pv;
	var z1 = state.z1;
	while (loop--) {
		var pi = stack.pop();
		var p = z1[pi];
		if (exports.DEBUG) console.log(state.step, (state.loop > 1 ? "loop " + (state.loop - loop) + ": " : "") + "ALIGNRP[]", pi);
		fv.setRelative(p, rp0, 0, pv);
		fv.touch(p);
	}
	state.loop = 1;
}
function RTDG(state) {
	if (exports.DEBUG) console.log(state.step, "RTDG[]");
	state.round = roundToDoubleGrid;
}
function MIAP(round, state) {
	var stack = state.stack;
	var n = stack.pop();
	var pi = stack.pop();
	var p = state.z0[pi];
	var fv = state.fv;
	var pv = state.pv;
	var cv = state.cvt[n];
	if (exports.DEBUG) console.log(state.step, "MIAP[" + round + "]", n, "(", cv, ")", pi);
	var d = pv.distance(p, HPZero);
	if (round) {
		if (Math.abs(d - cv) < state.cvCutIn) d = cv;
		d = state.round(d);
	}
	fv.setRelative(p, HPZero, d, pv);
	if (state.zp0 === 0) {
		p.xo = p.x;
		p.yo = p.y;
	}
	fv.touch(p);
	state.rp0 = state.rp1 = pi;
}
function NPUSHB(state) {
	var prog = state.prog;
	var ip = state.ip;
	var stack = state.stack;
	var n = prog[++ip];
	if (exports.DEBUG) console.log(state.step, "NPUSHB[]", n);
	for (var i = 0; i < n; i++) stack.push(prog[++ip]);
	state.ip = ip;
}
function NPUSHW(state) {
	var ip = state.ip;
	var prog = state.prog;
	var stack = state.stack;
	var n = prog[++ip];
	if (exports.DEBUG) console.log(state.step, "NPUSHW[]", n);
	for (var i = 0; i < n; i++) {
		var w = prog[++ip] << 8 | prog[++ip];
		if (w & 32768) w = -((w ^ 65535) + 1);
		stack.push(w);
	}
	state.ip = ip;
}
function WS(state) {
	var stack = state.stack;
	var store = state.store;
	if (!store) store = state.store = [];
	var v = stack.pop();
	var l = stack.pop();
	if (exports.DEBUG) console.log(state.step, "WS", v, l);
	store[l] = v;
}
function RS(state) {
	var stack = state.stack;
	var store = state.store;
	var l = stack.pop();
	if (exports.DEBUG) console.log(state.step, "RS", l);
	var v = store && store[l] || 0;
	stack.push(v);
}
function WCVTP(state) {
	var stack = state.stack;
	var v = stack.pop();
	var l = stack.pop();
	if (exports.DEBUG) console.log(state.step, "WCVTP", v, l);
	state.cvt[l] = v / 64;
}
function RCVT(state) {
	var stack = state.stack;
	var cvte = stack.pop();
	if (exports.DEBUG) console.log(state.step, "RCVT", cvte);
	stack.push(state.cvt[cvte] * 64);
}
function GC(a, state) {
	var stack = state.stack;
	var pi = stack.pop();
	var p = state.z2[pi];
	if (exports.DEBUG) console.log(state.step, "GC[" + a + "]", pi);
	stack.push(state.dpv.distance(p, HPZero, a, false) * 64);
}
function MD(a, state) {
	var stack = state.stack;
	var pi2 = stack.pop();
	var pi1 = stack.pop();
	var p2 = state.z1[pi2];
	var p1 = state.z0[pi1];
	var d = state.dpv.distance(p1, p2, a, a);
	if (exports.DEBUG) console.log(state.step, "MD[" + a + "]", pi2, pi1, "->", d);
	state.stack.push(Math.round(d * 64));
}
function MPPEM(state) {
	if (exports.DEBUG) console.log(state.step, "MPPEM[]");
	state.stack.push(state.ppem);
}
function FLIPON(state) {
	if (exports.DEBUG) console.log(state.step, "FLIPON[]");
	state.autoFlip = true;
}
function LT(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "LT[]", e2, e1);
	stack.push(e1 < e2 ? 1 : 0);
}
function LTEQ(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "LTEQ[]", e2, e1);
	stack.push(e1 <= e2 ? 1 : 0);
}
function GT(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "GT[]", e2, e1);
	stack.push(e1 > e2 ? 1 : 0);
}
function GTEQ(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "GTEQ[]", e2, e1);
	stack.push(e1 >= e2 ? 1 : 0);
}
function EQ(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "EQ[]", e2, e1);
	stack.push(e2 === e1 ? 1 : 0);
}
function NEQ(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "NEQ[]", e2, e1);
	stack.push(e2 !== e1 ? 1 : 0);
}
function ODD(state) {
	var stack = state.stack;
	var n = stack.pop();
	if (exports.DEBUG) console.log(state.step, "ODD[]", n);
	stack.push(Math.trunc(n) % 2 ? 1 : 0);
}
function EVEN(state) {
	var stack = state.stack;
	var n = stack.pop();
	if (exports.DEBUG) console.log(state.step, "EVEN[]", n);
	stack.push(Math.trunc(n) % 2 ? 0 : 1);
}
function IF(state) {
	var test = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "IF[]", test);
	if (!test) {
		skip(state, true);
		if (exports.DEBUG) console.log(state.step, "EIF[]");
	}
}
function EIF(state) {
	if (exports.DEBUG) console.log(state.step, "EIF[]");
}
function AND(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "AND[]", e2, e1);
	stack.push(e2 && e1 ? 1 : 0);
}
function OR(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "OR[]", e2, e1);
	stack.push(e2 || e1 ? 1 : 0);
}
function NOT(state) {
	var stack = state.stack;
	var e = stack.pop();
	if (exports.DEBUG) console.log(state.step, "NOT[]", e);
	stack.push(e ? 0 : 1);
}
function DELTAP123(b, state) {
	var stack = state.stack;
	var n = stack.pop();
	var fv = state.fv;
	var pv = state.pv;
	var ppem = state.ppem;
	var base = state.deltaBase + (b - 1) * 16;
	var ds = state.deltaShift;
	var z0 = state.z0;
	if (exports.DEBUG) console.log(state.step, "DELTAP[" + b + "]", n, stack);
	for (var i = 0; i < n; i++) {
		var pi = stack.pop();
		var arg = stack.pop();
		if (base + ((arg & 240) >> 4) !== ppem) continue;
		var mag = (arg & 15) - 8;
		if (mag >= 0) mag++;
		if (exports.DEBUG) console.log(state.step, "DELTAPFIX", pi, "by", mag * ds);
		var p = z0[pi];
		fv.setRelative(p, p, mag * ds, pv);
	}
}
function SDB(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SDB[]", n);
	state.deltaBase = n;
}
function SDS(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SDS[]", n);
	state.deltaShift = Math.pow(.5, n);
}
function ADD(state) {
	var stack = state.stack;
	var n2 = stack.pop();
	var n1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "ADD[]", n2, n1);
	stack.push(n1 + n2);
}
function SUB(state) {
	var stack = state.stack;
	var n2 = stack.pop();
	var n1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "SUB[]", n2, n1);
	stack.push(n1 - n2);
}
function DIV(state) {
	var stack = state.stack;
	var n2 = stack.pop();
	var n1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "DIV[]", n2, n1);
	stack.push(n1 * 64 / n2);
}
function MUL(state) {
	var stack = state.stack;
	var n2 = stack.pop();
	var n1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "MUL[]", n2, n1);
	stack.push(n1 * n2 / 64);
}
function ABS(state) {
	var stack = state.stack;
	var n = stack.pop();
	if (exports.DEBUG) console.log(state.step, "ABS[]", n);
	stack.push(Math.abs(n));
}
function NEG(state) {
	var stack = state.stack;
	var n = stack.pop();
	if (exports.DEBUG) console.log(state.step, "NEG[]", n);
	stack.push(-n);
}
function FLOOR(state) {
	var stack = state.stack;
	var n = stack.pop();
	if (exports.DEBUG) console.log(state.step, "FLOOR[]", n);
	stack.push(Math.floor(n / 64) * 64);
}
function CEILING(state) {
	var stack = state.stack;
	var n = stack.pop();
	if (exports.DEBUG) console.log(state.step, "CEILING[]", n);
	stack.push(Math.ceil(n / 64) * 64);
}
function ROUND(dt, state) {
	var stack = state.stack;
	var n = stack.pop();
	if (exports.DEBUG) console.log(state.step, "ROUND[]");
	stack.push(state.round(n / 64) * 64);
}
function WCVTF(state) {
	var stack = state.stack;
	var v = stack.pop();
	var l = stack.pop();
	if (exports.DEBUG) console.log(state.step, "WCVTF[]", v, l);
	state.cvt[l] = v * state.ppem / state.font.unitsPerEm;
}
function DELTAC123(b, state) {
	var stack = state.stack;
	var n = stack.pop();
	var ppem = state.ppem;
	var base = state.deltaBase + (b - 1) * 16;
	var ds = state.deltaShift;
	if (exports.DEBUG) console.log(state.step, "DELTAC[" + b + "]", n, stack);
	for (var i = 0; i < n; i++) {
		var c = stack.pop();
		var arg = stack.pop();
		if (base + ((arg & 240) >> 4) !== ppem) continue;
		var mag = (arg & 15) - 8;
		if (mag >= 0) mag++;
		var delta = mag * ds;
		if (exports.DEBUG) console.log(state.step, "DELTACFIX", c, "by", delta);
		state.cvt[c] += delta;
	}
}
function SROUND(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SROUND[]", n);
	state.round = roundSuper;
	var period;
	switch (n & 192) {
		case 0:
			period = .5;
			break;
		case 64:
			period = 1;
			break;
		case 128:
			period = 2;
			break;
		default: throw new Error("invalid SROUND value");
	}
	state.srPeriod = period;
	switch (n & 48) {
		case 0:
			state.srPhase = 0;
			break;
		case 16:
			state.srPhase = .25 * period;
			break;
		case 32:
			state.srPhase = .5 * period;
			break;
		case 48:
			state.srPhase = .75 * period;
			break;
		default: throw new Error("invalid SROUND value");
	}
	n &= 15;
	if (n === 0) state.srThreshold = 0;
	else state.srThreshold = (n / 8 - .5) * period;
}
function S45ROUND(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "S45ROUND[]", n);
	state.round = roundSuper;
	var period;
	switch (n & 192) {
		case 0:
			period = Math.sqrt(2) / 2;
			break;
		case 64:
			period = Math.sqrt(2);
			break;
		case 128:
			period = 2 * Math.sqrt(2);
			break;
		default: throw new Error("invalid S45ROUND value");
	}
	state.srPeriod = period;
	switch (n & 48) {
		case 0:
			state.srPhase = 0;
			break;
		case 16:
			state.srPhase = .25 * period;
			break;
		case 32:
			state.srPhase = .5 * period;
			break;
		case 48:
			state.srPhase = .75 * period;
			break;
		default: throw new Error("invalid S45ROUND value");
	}
	n &= 15;
	if (n === 0) state.srThreshold = 0;
	else state.srThreshold = (n / 8 - .5) * period;
}
function ROFF(state) {
	if (exports.DEBUG) console.log(state.step, "ROFF[]");
	state.round = roundOff;
}
function RUTG(state) {
	if (exports.DEBUG) console.log(state.step, "RUTG[]");
	state.round = roundUpToGrid;
}
function RDTG(state) {
	if (exports.DEBUG) console.log(state.step, "RDTG[]");
	state.round = roundDownToGrid;
}
function SCANCTRL(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SCANCTRL[]", n);
}
function SDPVTL(a, state) {
	var stack = state.stack;
	var p2i = stack.pop();
	var p1i = stack.pop();
	var p2 = state.z2[p2i];
	var p1 = state.z1[p1i];
	if (exports.DEBUG) console.log(state.step, "SDPVTL[" + a + "]", p2i, p1i);
	var dx;
	var dy;
	if (!a) {
		dx = p1.x - p2.x;
		dy = p1.y - p2.y;
	} else {
		dx = p2.y - p1.y;
		dy = p1.x - p2.x;
	}
	state.dpv = getUnitVector(dx, dy);
}
function GETINFO(state) {
	var stack = state.stack;
	var sel = stack.pop();
	var r = 0;
	if (exports.DEBUG) console.log(state.step, "GETINFO[]", sel);
	if (sel & 1) r = 35;
	if (sel & 32) r |= 4096;
	stack.push(r);
}
function ROLL(state) {
	var stack = state.stack;
	var a = stack.pop();
	var b = stack.pop();
	var c = stack.pop();
	if (exports.DEBUG) console.log(state.step, "ROLL[]");
	stack.push(b);
	stack.push(a);
	stack.push(c);
}
function MAX(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "MAX[]", e2, e1);
	stack.push(Math.max(e1, e2));
}
function MIN(state) {
	var stack = state.stack;
	var e2 = stack.pop();
	var e1 = stack.pop();
	if (exports.DEBUG) console.log(state.step, "MIN[]", e2, e1);
	stack.push(Math.min(e1, e2));
}
function SCANTYPE(state) {
	var n = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "SCANTYPE[]", n);
}
function INSTCTRL(state) {
	var s = state.stack.pop();
	var v = state.stack.pop();
	if (exports.DEBUG) console.log(state.step, "INSTCTRL[]", s, v);
	switch (s) {
		case 1:
			state.inhibitGridFit = !!v;
			return;
		case 2:
			state.ignoreCvt = !!v;
			return;
		default: throw new Error("invalid INSTCTRL[] selector");
	}
}
function PUSHB(n, state) {
	var stack = state.stack;
	var prog = state.prog;
	var ip = state.ip;
	if (exports.DEBUG) console.log(state.step, "PUSHB[" + n + "]");
	for (var i = 0; i < n; i++) stack.push(prog[++ip]);
	state.ip = ip;
}
function PUSHW(n, state) {
	var ip = state.ip;
	var prog = state.prog;
	var stack = state.stack;
	if (exports.DEBUG) console.log(state.ip, "PUSHW[" + n + "]");
	for (var i = 0; i < n; i++) {
		var w = prog[++ip] << 8 | prog[++ip];
		if (w & 32768) w = -((w ^ 65535) + 1);
		stack.push(w);
	}
	state.ip = ip;
}
function MDRP_MIRP(indirect, setRp0, keepD, ro, dt, state) {
	var stack = state.stack;
	var cvte = indirect && stack.pop();
	var pi = stack.pop();
	var rp0i = state.rp0;
	var rp = state.z0[rp0i];
	var p = state.z1[pi];
	var md = state.minDis;
	var fv = state.fv;
	var pv = state.dpv;
	var od;
	var d;
	var sign;
	var cv;
	d = od = pv.distance(p, rp, true, true);
	sign = d >= 0 ? 1 : -1;
	d = Math.abs(d);
	if (indirect) {
		cv = state.cvt[cvte];
		if (ro && Math.abs(d - cv) < state.cvCutIn) d = cv;
	}
	if (keepD && d < md) d = md;
	if (ro) d = state.round(d);
	fv.setRelative(p, rp, sign * d, pv);
	fv.touch(p);
	if (exports.DEBUG) console.log(state.step, (indirect ? "MIRP[" : "MDRP[") + (setRp0 ? "M" : "m") + (keepD ? ">" : "_") + (ro ? "R" : "_") + (dt === 0 ? "Gr" : dt === 1 ? "Bl" : dt === 2 ? "Wh" : "") + "]", indirect ? cvte + "(" + state.cvt[cvte] + "," + cv + ")" : "", pi, "(d =", od, "->", sign * d, ")");
	state.rp1 = state.rp0;
	state.rp2 = pi;
	if (setRp0) state.rp0 = pi;
}
instructionTable = [
	SVTCA.bind(void 0, yUnitVector),
	SVTCA.bind(void 0, xUnitVector),
	SPVTCA.bind(void 0, yUnitVector),
	SPVTCA.bind(void 0, xUnitVector),
	SFVTCA.bind(void 0, yUnitVector),
	SFVTCA.bind(void 0, xUnitVector),
	SPVTL.bind(void 0, 0),
	SPVTL.bind(void 0, 1),
	SFVTL.bind(void 0, 0),
	SFVTL.bind(void 0, 1),
	SPVFS,
	SFVFS,
	GPV,
	GFV,
	SFVTPV,
	ISECT,
	SRP0,
	SRP1,
	SRP2,
	SZP0,
	SZP1,
	SZP2,
	SZPS,
	SLOOP,
	RTG,
	RTHG,
	SMD,
	ELSE,
	JMPR,
	SCVTCI,
	void 0,
	void 0,
	DUP,
	POP,
	CLEAR,
	SWAP,
	DEPTH,
	CINDEX,
	MINDEX,
	void 0,
	void 0,
	void 0,
	LOOPCALL,
	CALL,
	FDEF,
	void 0,
	MDAP.bind(void 0, 0),
	MDAP.bind(void 0, 1),
	IUP.bind(void 0, yUnitVector),
	IUP.bind(void 0, xUnitVector),
	SHP.bind(void 0, 0),
	SHP.bind(void 0, 1),
	SHC.bind(void 0, 0),
	SHC.bind(void 0, 1),
	SHZ.bind(void 0, 0),
	SHZ.bind(void 0, 1),
	SHPIX,
	IP,
	MSIRP.bind(void 0, 0),
	MSIRP.bind(void 0, 1),
	ALIGNRP,
	RTDG,
	MIAP.bind(void 0, 0),
	MIAP.bind(void 0, 1),
	NPUSHB,
	NPUSHW,
	WS,
	RS,
	WCVTP,
	RCVT,
	GC.bind(void 0, 0),
	GC.bind(void 0, 1),
	void 0,
	MD.bind(void 0, 0),
	MD.bind(void 0, 1),
	MPPEM,
	void 0,
	FLIPON,
	void 0,
	void 0,
	LT,
	LTEQ,
	GT,
	GTEQ,
	EQ,
	NEQ,
	ODD,
	EVEN,
	IF,
	EIF,
	AND,
	OR,
	NOT,
	DELTAP123.bind(void 0, 1),
	SDB,
	SDS,
	ADD,
	SUB,
	DIV,
	MUL,
	ABS,
	NEG,
	FLOOR,
	CEILING,
	ROUND.bind(void 0, 0),
	ROUND.bind(void 0, 1),
	ROUND.bind(void 0, 2),
	ROUND.bind(void 0, 3),
	void 0,
	void 0,
	void 0,
	void 0,
	WCVTF,
	DELTAP123.bind(void 0, 2),
	DELTAP123.bind(void 0, 3),
	DELTAC123.bind(void 0, 1),
	DELTAC123.bind(void 0, 2),
	DELTAC123.bind(void 0, 3),
	SROUND,
	S45ROUND,
	void 0,
	void 0,
	ROFF,
	void 0,
	RUTG,
	RDTG,
	POP,
	POP,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	SCANCTRL,
	SDPVTL.bind(void 0, 0),
	SDPVTL.bind(void 0, 1),
	GETINFO,
	void 0,
	ROLL,
	MAX,
	MIN,
	SCANTYPE,
	INSTCTRL,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	PUSHB.bind(void 0, 1),
	PUSHB.bind(void 0, 2),
	PUSHB.bind(void 0, 3),
	PUSHB.bind(void 0, 4),
	PUSHB.bind(void 0, 5),
	PUSHB.bind(void 0, 6),
	PUSHB.bind(void 0, 7),
	PUSHB.bind(void 0, 8),
	PUSHW.bind(void 0, 1),
	PUSHW.bind(void 0, 2),
	PUSHW.bind(void 0, 3),
	PUSHW.bind(void 0, 4),
	PUSHW.bind(void 0, 5),
	PUSHW.bind(void 0, 6),
	PUSHW.bind(void 0, 7),
	PUSHW.bind(void 0, 8),
	MDRP_MIRP.bind(void 0, 0, 0, 0, 0, 0),
	MDRP_MIRP.bind(void 0, 0, 0, 0, 0, 1),
	MDRP_MIRP.bind(void 0, 0, 0, 0, 0, 2),
	MDRP_MIRP.bind(void 0, 0, 0, 0, 0, 3),
	MDRP_MIRP.bind(void 0, 0, 0, 0, 1, 0),
	MDRP_MIRP.bind(void 0, 0, 0, 0, 1, 1),
	MDRP_MIRP.bind(void 0, 0, 0, 0, 1, 2),
	MDRP_MIRP.bind(void 0, 0, 0, 0, 1, 3),
	MDRP_MIRP.bind(void 0, 0, 0, 1, 0, 0),
	MDRP_MIRP.bind(void 0, 0, 0, 1, 0, 1),
	MDRP_MIRP.bind(void 0, 0, 0, 1, 0, 2),
	MDRP_MIRP.bind(void 0, 0, 0, 1, 0, 3),
	MDRP_MIRP.bind(void 0, 0, 0, 1, 1, 0),
	MDRP_MIRP.bind(void 0, 0, 0, 1, 1, 1),
	MDRP_MIRP.bind(void 0, 0, 0, 1, 1, 2),
	MDRP_MIRP.bind(void 0, 0, 0, 1, 1, 3),
	MDRP_MIRP.bind(void 0, 0, 1, 0, 0, 0),
	MDRP_MIRP.bind(void 0, 0, 1, 0, 0, 1),
	MDRP_MIRP.bind(void 0, 0, 1, 0, 0, 2),
	MDRP_MIRP.bind(void 0, 0, 1, 0, 0, 3),
	MDRP_MIRP.bind(void 0, 0, 1, 0, 1, 0),
	MDRP_MIRP.bind(void 0, 0, 1, 0, 1, 1),
	MDRP_MIRP.bind(void 0, 0, 1, 0, 1, 2),
	MDRP_MIRP.bind(void 0, 0, 1, 0, 1, 3),
	MDRP_MIRP.bind(void 0, 0, 1, 1, 0, 0),
	MDRP_MIRP.bind(void 0, 0, 1, 1, 0, 1),
	MDRP_MIRP.bind(void 0, 0, 1, 1, 0, 2),
	MDRP_MIRP.bind(void 0, 0, 1, 1, 0, 3),
	MDRP_MIRP.bind(void 0, 0, 1, 1, 1, 0),
	MDRP_MIRP.bind(void 0, 0, 1, 1, 1, 1),
	MDRP_MIRP.bind(void 0, 0, 1, 1, 1, 2),
	MDRP_MIRP.bind(void 0, 0, 1, 1, 1, 3),
	MDRP_MIRP.bind(void 0, 1, 0, 0, 0, 0),
	MDRP_MIRP.bind(void 0, 1, 0, 0, 0, 1),
	MDRP_MIRP.bind(void 0, 1, 0, 0, 0, 2),
	MDRP_MIRP.bind(void 0, 1, 0, 0, 0, 3),
	MDRP_MIRP.bind(void 0, 1, 0, 0, 1, 0),
	MDRP_MIRP.bind(void 0, 1, 0, 0, 1, 1),
	MDRP_MIRP.bind(void 0, 1, 0, 0, 1, 2),
	MDRP_MIRP.bind(void 0, 1, 0, 0, 1, 3),
	MDRP_MIRP.bind(void 0, 1, 0, 1, 0, 0),
	MDRP_MIRP.bind(void 0, 1, 0, 1, 0, 1),
	MDRP_MIRP.bind(void 0, 1, 0, 1, 0, 2),
	MDRP_MIRP.bind(void 0, 1, 0, 1, 0, 3),
	MDRP_MIRP.bind(void 0, 1, 0, 1, 1, 0),
	MDRP_MIRP.bind(void 0, 1, 0, 1, 1, 1),
	MDRP_MIRP.bind(void 0, 1, 0, 1, 1, 2),
	MDRP_MIRP.bind(void 0, 1, 0, 1, 1, 3),
	MDRP_MIRP.bind(void 0, 1, 1, 0, 0, 0),
	MDRP_MIRP.bind(void 0, 1, 1, 0, 0, 1),
	MDRP_MIRP.bind(void 0, 1, 1, 0, 0, 2),
	MDRP_MIRP.bind(void 0, 1, 1, 0, 0, 3),
	MDRP_MIRP.bind(void 0, 1, 1, 0, 1, 0),
	MDRP_MIRP.bind(void 0, 1, 1, 0, 1, 1),
	MDRP_MIRP.bind(void 0, 1, 1, 0, 1, 2),
	MDRP_MIRP.bind(void 0, 1, 1, 0, 1, 3),
	MDRP_MIRP.bind(void 0, 1, 1, 1, 0, 0),
	MDRP_MIRP.bind(void 0, 1, 1, 1, 0, 1),
	MDRP_MIRP.bind(void 0, 1, 1, 1, 0, 2),
	MDRP_MIRP.bind(void 0, 1, 1, 1, 0, 3),
	MDRP_MIRP.bind(void 0, 1, 1, 1, 1, 0),
	MDRP_MIRP.bind(void 0, 1, 1, 1, 1, 1),
	MDRP_MIRP.bind(void 0, 1, 1, 1, 1, 2),
	MDRP_MIRP.bind(void 0, 1, 1, 1, 1, 3)
];
/*****************************
Mathematical Considerations
******************************

fv ... refers to freedom vector
pv ... refers to projection vector
rp ... refers to reference point
p  ... refers to to point being operated on
d  ... refers to distance

SETRELATIVE:
============

case freedom vector == x-axis:
------------------------------

(pv)
.-'
rpd .-'
.-*
d .-'90°'
.-'       '
.-'           '
*-'               ' b
rp                  '
'
'
p *----------*-------------- (fv)
pm

rpdx = rpx + d * pv.x
rpdy = rpy + d * pv.y

equation of line b

y - rpdy = pvns * (x- rpdx)

y = p.y

x = rpdx + ( p.y - rpdy ) / pvns


case freedom vector == y-axis:
------------------------------

* pm
|\
| \
|  \
|   \
|    \
|     \
|      \
|       \
|        \
|         \ b
|          \
|           \
|            \    .-' (pv)
|         90° \.-'
|           .-'* rpd
|        .-'
*     *-'  d
p     rp

rpdx = rpx + d * pv.x
rpdy = rpy + d * pv.y

equation of line b:
pvns ... normal slope to pv

y - rpdy = pvns * (x - rpdx)

x = p.x

y = rpdy +  pvns * (p.x - rpdx)



generic case:
-------------


.'(fv)
.'
.* pm
.' !
.'    .
.'      !
.'         . b
.'           !
*              .
p               !
90°   .    ... (pv)
...-*-'''
...---'''    rpd
...---'''   d
*--'''
rp

rpdx = rpx + d * pv.x
rpdy = rpy + d * pv.y

equation of line b:
pvns... normal slope to pv

y - rpdy = pvns * (x - rpdx)

equation of freedom vector line:
fvs ... slope of freedom vector (=fy/fx)

y - py = fvs * (x - px)


on pm both equations are true for same x/y

y - rpdy = pvns * (x - rpdx)

y - py = fvs * (x - px)

form to y and set equal:

pvns * (x - rpdx) + rpdy = fvs * (x - px) + py

expand:

pvns * x - pvns * rpdx + rpdy = fvs * x - fvs * px + py

switch:

fvs * x - fvs * px + py = pvns * x - pvns * rpdx + rpdy

solve for x:

fvs * x - pvns * x = fvs * px - pvns * rpdx - py + rpdy



fvs * px - pvns * rpdx + rpdy - py
x =  -----------------------------------
fvs - pvns

and:

y = fvs * (x - px) + py



INTERPOLATE:
============

Examples of point interpolation.

The weight of the movement of the reference point gets bigger
the further the other reference point is away, thus the safest
option (that is avoiding 0/0 divisions) is to weight the
original distance of the other point by the sum of both distances.

If the sum of both distances is 0, then move the point by the
arithmetic average of the movement of both reference points.




(+6)
rp1o *---->*rp1
.     .                          (+12)
.     .                  rp2o *---------->* rp2
.     .                       .           .
.     .                       .           .
.    10          20           .           .
|.........|...................|           .
.   .                               .
.   . (+8)                          .
po *------>*p                      .
.           .                       .
.    12     .          24           .
|...........|.......................|
36


-------



(+10)
rp1o *-------->*rp1
.         .                      (-10)
.         .              rp2 *<---------* rpo2
.         .                   .         .
.         .                   .         .
.    10   .          30       .         .
|.........|.............................|
.                   .
. (+5)              .
po *--->* p            .
.    .              .
.    .   20         .
|....|..............|
5        15


-------


(+10)
rp1o *-------->*rp1
.         .
.         .
rp2o *-------->*rp2


(+10)
po *-------->* p

-------


(+10)
rp1o *-------->*rp1
.         .
.         .(+30)
rp2o *---------------------------->*rp2


(+25)
po *----------------------->* p



vim: set ts=4 sw=4 expandtab:
*****/
/**
* Converts a string into a list of tokens.
*/
/**
* Create a new token
* @param {string} char a single char
*/
function Token(char) {
	this.char = char;
	this.state = {};
	this.activeState = null;
}
/**
* Create a new context range
* @param {number} startIndex range start index
* @param {number} endOffset range end index offset
* @param {string} contextName owner context name
*/
function ContextRange(startIndex, endOffset, contextName) {
	this.contextName = contextName;
	this.startIndex = startIndex;
	this.endOffset = endOffset;
}
/**
* Check context start and end
* @param {string} contextName a unique context name
* @param {function} checkStart a predicate function the indicates a context's start
* @param {function} checkEnd a predicate function the indicates a context's end
*/
function ContextChecker(contextName, checkStart, checkEnd) {
	this.contextName = contextName;
	this.openRange = null;
	this.ranges = [];
	this.checkStart = checkStart;
	this.checkEnd = checkEnd;
}
/**
* @typedef ContextParams
* @type Object
* @property {array} context context items
* @property {number} currentIndex current item index
*/
/**
* Create a context params
* @param {array} context a list of items
* @param {number} currentIndex current item index
*/
function ContextParams(context, currentIndex) {
	this.context = context;
	this.index = currentIndex;
	this.length = context.length;
	this.current = context[currentIndex];
	this.backtrack = context.slice(0, currentIndex);
	this.lookahead = context.slice(currentIndex + 1);
}
/**
* Create an event instance
* @param {string} eventId event unique id
*/
function Event(eventId) {
	this.eventId = eventId;
	this.subscribers = [];
}
/**
* Initialize a core events and auto subscribe required event handlers
* @param {any} events an object that enlists core events handlers
*/
function initializeCoreEvents(events) {
	var this$1 = this;
	var coreEvents = [
		"start",
		"end",
		"next",
		"newToken",
		"contextStart",
		"contextEnd",
		"insertToken",
		"removeToken",
		"removeRange",
		"replaceToken",
		"replaceRange",
		"composeRUD",
		"updateContextsRanges"
	];
	coreEvents.forEach(function(eventId) {
		Object.defineProperty(this$1.events, eventId, { value: new Event(eventId) });
	});
	if (!!events) coreEvents.forEach(function(eventId) {
		var event = events[eventId];
		if (typeof event === "function") this$1.events[eventId].subscribe(event);
	});
	[
		"insertToken",
		"removeToken",
		"removeRange",
		"replaceToken",
		"replaceRange",
		"composeRUD"
	].forEach(function(eventId) {
		this$1.events[eventId].subscribe(this$1.updateContextsRanges);
	});
}
/**
* Converts a string into a list of tokens
* @param {any} events tokenizer core events
*/
function Tokenizer(events) {
	this.tokens = [];
	this.registeredContexts = {};
	this.contextCheckers = [];
	this.events = {};
	this.registeredModifiers = [];
	initializeCoreEvents.call(this, events);
}
/**
* Sets the state of a token, usually called by a state modifier.
* @param {string} key state item key
* @param {any} value state item value
*/
Token.prototype.setState = function(key, value) {
	this.state[key] = value;
	this.activeState = {
		key,
		value: this.state[key]
	};
	return this.activeState;
};
Token.prototype.getState = function(stateId) {
	return this.state[stateId] || null;
};
/**
* Checks if an index exists in the tokens list.
* @param {number} index token index
*/
Tokenizer.prototype.inboundIndex = function(index) {
	return index >= 0 && index < this.tokens.length;
};
/**
* Compose and apply a list of operations (replace, update, delete)
* @param {array} RUDs replace, update and delete operations
* TODO: Perf. Optimization (lengthBefore === lengthAfter ? dispatch once)
*/
Tokenizer.prototype.composeRUD = function(RUDs) {
	var this$1 = this;
	var silent = true;
	var state = RUDs.map(function(RUD) {
		return this$1[RUD[0]].apply(this$1, RUD.slice(1).concat(silent));
	});
	var hasFAILObject = function(obj) {
		return typeof obj === "object" && obj.hasOwnProperty("FAIL");
	};
	if (state.every(hasFAILObject)) return {
		FAIL: "composeRUD: one or more operations hasn't completed successfully",
		report: state.filter(hasFAILObject)
	};
	this.dispatch("composeRUD", [state.filter(function(op) {
		return !hasFAILObject(op);
	})]);
};
/**
* Replace a range of tokens with a list of tokens
* @param {number} startIndex range start index
* @param {number} offset range offset
* @param {token} tokens a list of tokens to replace
* @param {boolean} silent dispatch events and update context ranges
*/
Tokenizer.prototype.replaceRange = function(startIndex, offset, tokens, silent) {
	offset = offset !== null ? offset : this.tokens.length;
	var isTokenType = tokens.every(function(token) {
		return token instanceof Token;
	});
	if (!isNaN(startIndex) && this.inboundIndex(startIndex) && isTokenType) {
		var replaced = this.tokens.splice.apply(this.tokens, [startIndex, offset].concat(tokens));
		if (!silent) this.dispatch("replaceToken", [
			startIndex,
			offset,
			tokens
		]);
		return [replaced, tokens];
	} else return { FAIL: "replaceRange: invalid tokens or startIndex." };
};
/**
* Replace a token with another token
* @param {number} index token index
* @param {token} token a token to replace
* @param {boolean} silent dispatch events and update context ranges
*/
Tokenizer.prototype.replaceToken = function(index, token, silent) {
	if (!isNaN(index) && this.inboundIndex(index) && token instanceof Token) {
		var replaced = this.tokens.splice(index, 1, token);
		if (!silent) this.dispatch("replaceToken", [index, token]);
		return [replaced[0], token];
	} else return { FAIL: "replaceToken: invalid token or index." };
};
/**
* Removes a range of tokens
* @param {number} startIndex range start index
* @param {number} offset range offset
* @param {boolean} silent dispatch events and update context ranges
*/
Tokenizer.prototype.removeRange = function(startIndex, offset, silent) {
	offset = !isNaN(offset) ? offset : this.tokens.length;
	var tokens = this.tokens.splice(startIndex, offset);
	if (!silent) this.dispatch("removeRange", [
		tokens,
		startIndex,
		offset
	]);
	return tokens;
};
/**
* Remove a token at a certain index
* @param {number} index token index
* @param {boolean} silent dispatch events and update context ranges
*/
Tokenizer.prototype.removeToken = function(index, silent) {
	if (!isNaN(index) && this.inboundIndex(index)) {
		var token = this.tokens.splice(index, 1);
		if (!silent) this.dispatch("removeToken", [token, index]);
		return token;
	} else return { FAIL: "removeToken: invalid token index." };
};
/**
* Insert a list of tokens at a certain index
* @param {array} tokens a list of tokens to insert
* @param {number} index insert the list of tokens at index
* @param {boolean} silent dispatch events and update context ranges
*/
Tokenizer.prototype.insertToken = function(tokens, index, silent) {
	if (tokens.every(function(token) {
		return token instanceof Token;
	})) {
		this.tokens.splice.apply(this.tokens, [index, 0].concat(tokens));
		if (!silent) this.dispatch("insertToken", [tokens, index]);
		return tokens;
	} else return { FAIL: "insertToken: invalid token(s)." };
};
/**
* A state modifier that is called on 'newToken' event
* @param {string} modifierId state modifier id
* @param {function} condition a predicate function that returns true or false
* @param {function} modifier a function to update token state
*/
Tokenizer.prototype.registerModifier = function(modifierId, condition, modifier) {
	this.events.newToken.subscribe(function(token, contextParams) {
		var conditionParams = [token, contextParams];
		var canApplyModifier = condition === null || condition.apply(this, conditionParams) === true;
		var modifierParams = [token, contextParams];
		if (canApplyModifier) {
			var newStateValue = modifier.apply(this, modifierParams);
			token.setState(modifierId, newStateValue);
		}
	});
	this.registeredModifiers.push(modifierId);
};
/**
* Subscribe a handler to an event
* @param {function} eventHandler an event handler function
*/
Event.prototype.subscribe = function(eventHandler) {
	if (typeof eventHandler === "function") return this.subscribers.push(eventHandler) - 1;
	else return { FAIL: "invalid '" + this.eventId + "' event handler" };
};
/**
* Unsubscribe an event handler
* @param {string} subsId subscription id
*/
Event.prototype.unsubscribe = function(subsId) {
	this.subscribers.splice(subsId, 1);
};
/**
* Sets context params current value index
* @param {number} index context params current value index
*/
ContextParams.prototype.setCurrentIndex = function(index) {
	this.index = index;
	this.current = this.context[index];
	this.backtrack = this.context.slice(0, index);
	this.lookahead = this.context.slice(index + 1);
};
/**
* Get an item at an offset from the current value
* example (current value is 3):
*  1    2   [3]   4    5   |   items values
* -2   -1    0    1    2   |   offset values
* @param {number} offset an offset from current value index
*/
ContextParams.prototype.get = function(offset) {
	switch (true) {
		case offset === 0: return this.current;
		case offset < 0 && Math.abs(offset) <= this.backtrack.length: return this.backtrack.slice(offset)[0];
		case offset > 0 && offset <= this.lookahead.length: return this.lookahead[offset - 1];
		default: return null;
	}
};
/**
* Converts a context range into a string value
* @param {contextRange} range a context range
*/
Tokenizer.prototype.rangeToText = function(range) {
	if (range instanceof ContextRange) return this.getRangeTokens(range).map(function(token) {
		return token.char;
	}).join("");
};
/**
* Converts all tokens into a string
*/
Tokenizer.prototype.getText = function() {
	return this.tokens.map(function(token) {
		return token.char;
	}).join("");
};
/**
* Get a context by name
* @param {string} contextName context name to get
*/
Tokenizer.prototype.getContext = function(contextName) {
	var context = this.registeredContexts[contextName];
	return !!context ? context : null;
};
/**
* Subscribes a new event handler to an event
* @param {string} eventName event name to subscribe to
* @param {function} eventHandler a function to be invoked on event
*/
Tokenizer.prototype.on = function(eventName, eventHandler) {
	var event = this.events[eventName];
	if (!!event) return event.subscribe(eventHandler);
	else return null;
};
/**
* Dispatches an event
* @param {string} eventName event name
* @param {any} args event handler arguments
*/
Tokenizer.prototype.dispatch = function(eventName, args) {
	var this$1 = this;
	var event = this.events[eventName];
	if (event instanceof Event) event.subscribers.forEach(function(subscriber) {
		subscriber.apply(this$1, args || []);
	});
};
/**
* Register a new context checker
* @param {string} contextName a unique context name
* @param {function} contextStartCheck a predicate function that returns true on context start
* @param {function} contextEndCheck  a predicate function that returns true on context end
* TODO: call tokenize on registration to update context ranges with the new context.
*/
Tokenizer.prototype.registerContextChecker = function(contextName, contextStartCheck, contextEndCheck) {
	if (!!this.getContext(contextName)) return { FAIL: "context name '" + contextName + "' is already registered." };
	if (typeof contextStartCheck !== "function") return { FAIL: "missing context start check." };
	if (typeof contextEndCheck !== "function") return { FAIL: "missing context end check." };
	var contextCheckers = new ContextChecker(contextName, contextStartCheck, contextEndCheck);
	this.registeredContexts[contextName] = contextCheckers;
	this.contextCheckers.push(contextCheckers);
	return contextCheckers;
};
/**
* Gets a context range tokens
* @param {contextRange} range a context range
*/
Tokenizer.prototype.getRangeTokens = function(range) {
	var endIndex = range.startIndex + range.endOffset;
	return [].concat(this.tokens.slice(range.startIndex, endIndex));
};
/**
* Gets the ranges of a context
* @param {string} contextName context name
*/
Tokenizer.prototype.getContextRanges = function(contextName) {
	var context = this.getContext(contextName);
	if (!!context) return context.ranges;
	else return { FAIL: "context checker '" + contextName + "' is not registered." };
};
/**
* Resets context ranges to run context update
*/
Tokenizer.prototype.resetContextsRanges = function() {
	var registeredContexts = this.registeredContexts;
	for (var contextName in registeredContexts) if (registeredContexts.hasOwnProperty(contextName)) {
		var context = registeredContexts[contextName];
		context.ranges = [];
	}
};
/**
* Updates context ranges
*/
Tokenizer.prototype.updateContextsRanges = function() {
	this.resetContextsRanges();
	var chars = this.tokens.map(function(token) {
		return token.char;
	});
	for (var i = 0; i < chars.length; i++) {
		var contextParams = new ContextParams(chars, i);
		this.runContextCheck(contextParams);
	}
	this.dispatch("updateContextsRanges", [this.registeredContexts]);
};
/**
* Sets the end offset of an open range
* @param {number} offset range end offset
* @param {string} contextName context name
*/
Tokenizer.prototype.setEndOffset = function(offset, contextName) {
	var startIndex = this.getContext(contextName).openRange.startIndex;
	var range = new ContextRange(startIndex, offset, contextName);
	var ranges = this.getContext(contextName).ranges;
	range.rangeId = contextName + "." + ranges.length;
	ranges.push(range);
	this.getContext(contextName).openRange = null;
	return range;
};
/**
* Runs a context check on the current context
* @param {contextParams} contextParams current context params
*/
Tokenizer.prototype.runContextCheck = function(contextParams) {
	var this$1 = this;
	var index = contextParams.index;
	this.contextCheckers.forEach(function(contextChecker) {
		var contextName = contextChecker.contextName;
		var openRange = this$1.getContext(contextName).openRange;
		if (!openRange && contextChecker.checkStart(contextParams)) {
			openRange = new ContextRange(index, null, contextName);
			this$1.getContext(contextName).openRange = openRange;
			this$1.dispatch("contextStart", [contextName, index]);
		}
		if (!!openRange && contextChecker.checkEnd(contextParams)) {
			var offset = index - openRange.startIndex + 1;
			var range = this$1.setEndOffset(offset, contextName);
			this$1.dispatch("contextEnd", [contextName, range]);
		}
	});
};
/**
* Converts a text into a list of tokens
* @param {string} text a text to tokenize
*/
Tokenizer.prototype.tokenize = function(text) {
	this.tokens = [];
	this.resetContextsRanges();
	var chars = Array.from(text);
	this.dispatch("start");
	for (var i = 0; i < chars.length; i++) {
		var char = chars[i];
		var contextParams = new ContextParams(chars, i);
		this.dispatch("next", [contextParams]);
		this.runContextCheck(contextParams);
		var token = new Token(char);
		this.tokens.push(token);
		this.dispatch("newToken", [token, contextParams]);
	}
	this.dispatch("end", [this.tokens]);
	return this.tokens;
};
/**
* Check if a char is Arabic
* @param {string} c a single char
*/
function isArabicChar(c) {
	return /[\u0600-\u065F\u066A-\u06D2\u06FA-\u06FF]/.test(c);
}
/**
* Check if a char is an isolated arabic char
* @param {string} c a single char
*/
function isIsolatedArabicChar(char) {
	return /[\u0630\u0690\u0621\u0631\u0661\u0671\u0622\u0632\u0672\u0692\u06C2\u0623\u0673\u0693\u06C3\u0624\u0694\u06C4\u0625\u0675\u0695\u06C5\u06E5\u0676\u0696\u06C6\u0627\u0677\u0697\u06C7\u0648\u0688\u0698\u06C8\u0689\u0699\u06C9\u068A\u06CA\u066B\u068B\u06CB\u068C\u068D\u06CD\u06FD\u068E\u06EE\u06FE\u062F\u068F\u06CF\u06EF]/.test(char);
}
/**
* Check if a char is an Arabic Tashkeel char
* @param {string} c a single char
*/
function isTashkeelArabicChar(char) {
	return /[\u0600-\u0605\u060C-\u060E\u0610-\u061B\u061E\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/.test(char);
}
/**
* Check if a char is Latin
* @param {string} c a single char
*/
function isLatinChar(c) {
	return /[A-z]/.test(c);
}
/**
* Check if a char is whitespace char
* @param {string} c a single char
*/
function isWhiteSpace(c) {
	return /\s/.test(c);
}
/**
* Query a feature by some of it's properties to lookup a glyph substitution.
*/
/**
* Create feature query instance
* @param {Font} font opentype font instance
*/
function FeatureQuery(font) {
	this.font = font;
	this.features = {};
}
/**
* @typedef SubstitutionAction
* @type Object
* @property {number} id substitution type
* @property {string} tag feature tag
* @property {any} substitution substitution value(s)
*/
/**
* Create a substitution action instance
* @param {SubstitutionAction} action
*/
function SubstitutionAction(action) {
	this.id = action.id;
	this.tag = action.tag;
	this.substitution = action.substitution;
}
/**
* Lookup a coverage table
* @param {number} glyphIndex glyph index
* @param {CoverageTable} coverage coverage table
*/
function lookupCoverage(glyphIndex, coverage) {
	if (!glyphIndex) return -1;
	switch (coverage.format) {
		case 1: return coverage.glyphs.indexOf(glyphIndex);
		case 2:
			var ranges = coverage.ranges;
			for (var i = 0; i < ranges.length; i++) {
				var range = ranges[i];
				if (glyphIndex >= range.start && glyphIndex <= range.end) {
					var offset = glyphIndex - range.start;
					return range.index + offset;
				}
			}
			break;
		default: return -1;
	}
	return -1;
}
/**
* Handle a single substitution - format 1
* @param {ContextParams} contextParams context params to lookup
*/
function singleSubstitutionFormat1(glyphIndex, subtable) {
	if (lookupCoverage(glyphIndex, subtable.coverage) === -1) return null;
	return glyphIndex + subtable.deltaGlyphId;
}
/**
* Handle a single substitution - format 2
* @param {ContextParams} contextParams context params to lookup
*/
function singleSubstitutionFormat2(glyphIndex, subtable) {
	var substituteIndex = lookupCoverage(glyphIndex, subtable.coverage);
	if (substituteIndex === -1) return null;
	return subtable.substitute[substituteIndex];
}
/**
* Lookup a list of coverage tables
* @param {any} coverageList a list of coverage tables
* @param {ContextParams} contextParams context params to lookup
*/
function lookupCoverageList(coverageList, contextParams) {
	var lookupList = [];
	for (var i = 0; i < coverageList.length; i++) {
		var coverage = coverageList[i];
		var glyphIndex = contextParams.current;
		glyphIndex = Array.isArray(glyphIndex) ? glyphIndex[0] : glyphIndex;
		var lookupIndex = lookupCoverage(glyphIndex, coverage);
		if (lookupIndex !== -1) lookupList.push(lookupIndex);
	}
	if (lookupList.length !== coverageList.length) return -1;
	return lookupList;
}
/**
* Handle chaining context substitution - format 3
* @param {ContextParams} contextParams context params to lookup
*/
function chainingSubstitutionFormat3(contextParams, subtable) {
	var lookupsCount = subtable.inputCoverage.length + subtable.lookaheadCoverage.length + subtable.backtrackCoverage.length;
	if (contextParams.context.length < lookupsCount) return [];
	var inputLookups = lookupCoverageList(subtable.inputCoverage, contextParams);
	if (inputLookups === -1) return [];
	var lookaheadOffset = subtable.inputCoverage.length - 1;
	if (contextParams.lookahead.length < subtable.lookaheadCoverage.length) return [];
	var lookaheadContext = contextParams.lookahead.slice(lookaheadOffset);
	while (lookaheadContext.length && isTashkeelArabicChar(lookaheadContext[0].char)) lookaheadContext.shift();
	var lookaheadParams = new ContextParams(lookaheadContext, 0);
	var lookaheadLookups = lookupCoverageList(subtable.lookaheadCoverage, lookaheadParams);
	var backtrackContext = [].concat(contextParams.backtrack);
	backtrackContext.reverse();
	while (backtrackContext.length && isTashkeelArabicChar(backtrackContext[0].char)) backtrackContext.shift();
	if (backtrackContext.length < subtable.backtrackCoverage.length) return [];
	var backtrackParams = new ContextParams(backtrackContext, 0);
	var backtrackLookups = lookupCoverageList(subtable.backtrackCoverage, backtrackParams);
	var contextRulesMatch = inputLookups.length === subtable.inputCoverage.length && lookaheadLookups.length === subtable.lookaheadCoverage.length && backtrackLookups.length === subtable.backtrackCoverage.length;
	var substitutions = [];
	if (contextRulesMatch) for (var i = 0; i < subtable.lookupRecords.length; i++) {
		var lookupListIndex = subtable.lookupRecords[i].lookupListIndex;
		var lookupTable = this.getLookupByIndex(lookupListIndex);
		for (var s = 0; s < lookupTable.subtables.length; s++) {
			var subtable$1 = lookupTable.subtables[s];
			var lookup = this.getLookupMethod(lookupTable, subtable$1);
			if (this.getSubstitutionType(lookupTable, subtable$1) === "12") for (var n = 0; n < inputLookups.length; n++) {
				var substitution = lookup(contextParams.get(n));
				if (substitution) substitutions.push(substitution);
			}
		}
	}
	return substitutions;
}
/**
* Handle ligature substitution - format 1
* @param {ContextParams} contextParams context params to lookup
*/
function ligatureSubstitutionFormat1(contextParams, subtable) {
	var glyphIndex = contextParams.current;
	var ligSetIndex = lookupCoverage(glyphIndex, subtable.coverage);
	if (ligSetIndex === -1) return null;
	var ligature;
	var ligatureSet = subtable.ligatureSets[ligSetIndex];
	for (var s = 0; s < ligatureSet.length; s++) {
		ligature = ligatureSet[s];
		for (var l = 0; l < ligature.components.length; l++) {
			if (contextParams.lookahead[l] !== ligature.components[l]) break;
			if (l === ligature.components.length - 1) return ligature;
		}
	}
	return null;
}
/**
* Handle decomposition substitution - format 1
* @param {number} glyphIndex glyph index
* @param {any} subtable subtable
*/
function decompositionSubstitutionFormat1(glyphIndex, subtable) {
	var substituteIndex = lookupCoverage(glyphIndex, subtable.coverage);
	if (substituteIndex === -1) return null;
	return subtable.sequences[substituteIndex];
}
/**
* Get default script features indexes
*/
FeatureQuery.prototype.getDefaultScriptFeaturesIndexes = function() {
	var scripts = this.font.tables.gsub.scripts;
	for (var s = 0; s < scripts.length; s++) {
		var script = scripts[s];
		if (script.tag === "DFLT") return script.script.defaultLangSys.featureIndexes;
	}
	return [];
};
/**
* Get feature indexes of a specific script
* @param {string} scriptTag script tag
*/
FeatureQuery.prototype.getScriptFeaturesIndexes = function(scriptTag) {
	if (!this.font.tables.gsub) return [];
	if (!scriptTag) return this.getDefaultScriptFeaturesIndexes();
	var scripts = this.font.tables.gsub.scripts;
	for (var i = 0; i < scripts.length; i++) {
		var script = scripts[i];
		if (script.tag === scriptTag && script.script.defaultLangSys) return script.script.defaultLangSys.featureIndexes;
		else {
			var langSysRecords = script.langSysRecords;
			if (!!langSysRecords) for (var j = 0; j < langSysRecords.length; j++) {
				var langSysRecord = langSysRecords[j];
				if (langSysRecord.tag === scriptTag) return langSysRecord.langSys.featureIndexes;
			}
		}
	}
	return this.getDefaultScriptFeaturesIndexes();
};
/**
* Map a feature tag to a gsub feature
* @param {any} features gsub features
* @param {string} scriptTag script tag
*/
FeatureQuery.prototype.mapTagsToFeatures = function(features, scriptTag) {
	var tags = {};
	for (var i = 0; i < features.length; i++) {
		var tag = features[i].tag;
		tags[tag] = features[i].feature;
	}
	this.features[scriptTag].tags = tags;
};
/**
* Get features of a specific script
* @param {string} scriptTag script tag
*/
FeatureQuery.prototype.getScriptFeatures = function(scriptTag) {
	var features = this.features[scriptTag];
	if (this.features.hasOwnProperty(scriptTag)) return features;
	var featuresIndexes = this.getScriptFeaturesIndexes(scriptTag);
	if (!featuresIndexes) return null;
	var gsub = this.font.tables.gsub;
	features = featuresIndexes.map(function(index) {
		return gsub.features[index];
	});
	this.features[scriptTag] = features;
	this.mapTagsToFeatures(features, scriptTag);
	return features;
};
/**
* Get substitution type
* @param {any} lookupTable lookup table
* @param {any} subtable subtable
*/
FeatureQuery.prototype.getSubstitutionType = function(lookupTable, subtable) {
	return lookupTable.lookupType.toString() + subtable.substFormat.toString();
};
/**
* Get lookup method
* @param {any} lookupTable lookup table
* @param {any} subtable subtable
*/
FeatureQuery.prototype.getLookupMethod = function(lookupTable, subtable) {
	var this$1 = this;
	switch (this.getSubstitutionType(lookupTable, subtable)) {
		case "11": return function(glyphIndex) {
			return singleSubstitutionFormat1.apply(this$1, [glyphIndex, subtable]);
		};
		case "12": return function(glyphIndex) {
			return singleSubstitutionFormat2.apply(this$1, [glyphIndex, subtable]);
		};
		case "63": return function(contextParams) {
			return chainingSubstitutionFormat3.apply(this$1, [contextParams, subtable]);
		};
		case "41": return function(contextParams) {
			return ligatureSubstitutionFormat1.apply(this$1, [contextParams, subtable]);
		};
		case "21": return function(glyphIndex) {
			return decompositionSubstitutionFormat1.apply(this$1, [glyphIndex, subtable]);
		};
		default: throw new Error("lookupType: " + lookupTable.lookupType + " - substFormat: " + subtable.substFormat + " is not yet supported");
	}
};
/**
* [ LOOKUP TYPES ]
* -------------------------------
* Single                        1;
* Multiple                      2;
* Alternate                     3;
* Ligature                      4;
* Context                       5;
* ChainingContext               6;
* ExtensionSubstitution         7;
* ReverseChainingContext        8;
* -------------------------------
*
*/
/**
* @typedef FQuery
* @type Object
* @param {string} tag feature tag
* @param {string} script feature script
* @param {ContextParams} contextParams context params
*/
/**
* Lookup a feature using a query parameters
* @param {FQuery} query feature query
*/
FeatureQuery.prototype.lookupFeature = function(query) {
	var contextParams = query.contextParams;
	var currentIndex = contextParams.index;
	var feature = this.getFeature({
		tag: query.tag,
		script: query.script
	});
	if (!feature) return /* @__PURE__ */ new Error("font '" + this.font.names.fullName.en + "' doesn't support feature '" + query.tag + "' for script '" + query.script + "'.");
	var lookups = this.getFeatureLookups(feature);
	var substitutions = [].concat(contextParams.context);
	for (var l = 0; l < lookups.length; l++) {
		var lookupTable = lookups[l];
		var subtables = this.getLookupSubtables(lookupTable);
		for (var s = 0; s < subtables.length; s++) {
			var subtable = subtables[s];
			var substType = this.getSubstitutionType(lookupTable, subtable);
			var lookup = this.getLookupMethod(lookupTable, subtable);
			var substitution = void 0;
			switch (substType) {
				case "11":
					substitution = lookup(contextParams.current);
					if (substitution) substitutions.splice(currentIndex, 1, new SubstitutionAction({
						id: 11,
						tag: query.tag,
						substitution
					}));
					break;
				case "12":
					substitution = lookup(contextParams.current);
					if (substitution) substitutions.splice(currentIndex, 1, new SubstitutionAction({
						id: 12,
						tag: query.tag,
						substitution
					}));
					break;
				case "63":
					substitution = lookup(contextParams);
					if (Array.isArray(substitution) && substitution.length) substitutions.splice(currentIndex, 1, new SubstitutionAction({
						id: 63,
						tag: query.tag,
						substitution
					}));
					break;
				case "41":
					substitution = lookup(contextParams);
					if (substitution) substitutions.splice(currentIndex, 1, new SubstitutionAction({
						id: 41,
						tag: query.tag,
						substitution
					}));
					break;
				case "21":
					substitution = lookup(contextParams.current);
					if (substitution) substitutions.splice(currentIndex, 1, new SubstitutionAction({
						id: 21,
						tag: query.tag,
						substitution
					}));
			}
			contextParams = new ContextParams(substitutions, currentIndex);
			if (Array.isArray(substitution) && !substitution.length) continue;
			substitution = null;
		}
	}
	return substitutions.length ? substitutions : null;
};
/**
* Checks if a font supports a specific features
* @param {FQuery} query feature query object
*/
FeatureQuery.prototype.supports = function(query) {
	if (!query.script) return false;
	this.getScriptFeatures(query.script);
	var supportedScript = this.features.hasOwnProperty(query.script);
	if (!query.tag) return supportedScript;
	var supportedFeature = this.features[query.script].some(function(feature) {
		return feature.tag === query.tag;
	});
	return supportedScript && supportedFeature;
};
/**
* Get lookup table subtables
* @param {any} lookupTable lookup table
*/
FeatureQuery.prototype.getLookupSubtables = function(lookupTable) {
	return lookupTable.subtables || null;
};
/**
* Get lookup table by index
* @param {number} index lookup table index
*/
FeatureQuery.prototype.getLookupByIndex = function(index) {
	return this.font.tables.gsub.lookups[index] || null;
};
/**
* Get lookup tables for a feature
* @param {string} feature
*/
FeatureQuery.prototype.getFeatureLookups = function(feature) {
	return feature.lookupListIndexes.map(this.getLookupByIndex.bind(this));
};
/**
* Query a feature by it's properties
* @param {any} query an object that describes the properties of a query
*/
FeatureQuery.prototype.getFeature = function getFeature(query) {
	if (!this.font) return { FAIL: "No font was found" };
	if (!this.features.hasOwnProperty(query.script)) this.getScriptFeatures(query.script);
	var scriptFeatures = this.features[query.script];
	if (!scriptFeatures) return { FAIL: "No feature for script " + query.script };
	if (!scriptFeatures.tags[query.tag]) return null;
	return this.features[query.script].tags[query.tag];
};
/**
* Arabic word context checkers
*/
function arabicWordStartCheck(contextParams) {
	var char = contextParams.current;
	var prevChar = contextParams.get(-1);
	return prevChar === null && isArabicChar(char) || !isArabicChar(prevChar) && isArabicChar(char);
}
function arabicWordEndCheck(contextParams) {
	var nextChar = contextParams.get(1);
	return nextChar === null || !isArabicChar(nextChar);
}
var arabicWordCheck = {
	startCheck: arabicWordStartCheck,
	endCheck: arabicWordEndCheck
};
/**
* Arabic sentence context checkers
*/
function arabicSentenceStartCheck(contextParams) {
	var char = contextParams.current;
	var prevChar = contextParams.get(-1);
	return (isArabicChar(char) || isTashkeelArabicChar(char)) && !isArabicChar(prevChar);
}
function arabicSentenceEndCheck(contextParams) {
	var nextChar = contextParams.get(1);
	switch (true) {
		case nextChar === null: return true;
		case !isArabicChar(nextChar) && !isTashkeelArabicChar(nextChar):
			var nextIsWhitespace = isWhiteSpace(nextChar);
			if (!nextIsWhitespace) return true;
			if (nextIsWhitespace) {
				var arabicCharAhead = false;
				arabicCharAhead = contextParams.lookahead.some(function(c) {
					return isArabicChar(c) || isTashkeelArabicChar(c);
				});
				if (!arabicCharAhead) return true;
			}
			break;
		default: return false;
	}
}
var arabicSentenceCheck = {
	startCheck: arabicSentenceStartCheck,
	endCheck: arabicSentenceEndCheck
};
/**
* Apply single substitution format 1
* @param {Array} substitutions substitutions
* @param {any} tokens a list of tokens
* @param {number} index token index
*/
function singleSubstitutionFormat1$1(action, tokens, index) {
	tokens[index].setState(action.tag, action.substitution);
}
/**
* Apply single substitution format 2
* @param {Array} substitutions substitutions
* @param {any} tokens a list of tokens
* @param {number} index token index
*/
function singleSubstitutionFormat2$1(action, tokens, index) {
	tokens[index].setState(action.tag, action.substitution);
}
/**
* Apply chaining context substitution format 3
* @param {Array} substitutions substitutions
* @param {any} tokens a list of tokens
* @param {number} index token index
*/
function chainingSubstitutionFormat3$1(action, tokens, index) {
	action.substitution.forEach(function(subst, offset) {
		tokens[index + offset].setState(action.tag, subst);
	});
}
/**
* Apply ligature substitution format 1
* @param {Array} substitutions substitutions
* @param {any} tokens a list of tokens
* @param {number} index token index
*/
function ligatureSubstitutionFormat1$1(action, tokens, index) {
	var token = tokens[index];
	token.setState(action.tag, action.substitution.ligGlyph);
	var compsCount = action.substitution.components.length;
	for (var i = 0; i < compsCount; i++) {
		token = tokens[index + i + 1];
		token.setState("deleted", true);
	}
}
/**
* Supported substitutions
*/
var SUBSTITUTIONS = {
	11: singleSubstitutionFormat1$1,
	12: singleSubstitutionFormat2$1,
	63: chainingSubstitutionFormat3$1,
	41: ligatureSubstitutionFormat1$1
};
/**
* Apply substitutions to a list of tokens
* @param {Array} substitutions substitutions
* @param {any} tokens a list of tokens
* @param {number} index token index
*/
function applySubstitution(action, tokens, index) {
	if (action instanceof SubstitutionAction && SUBSTITUTIONS[action.id]) SUBSTITUTIONS[action.id](action, tokens, index);
}
/**
* Apply Arabic presentation forms to a range of tokens
*/
/**
* Check if a char can be connected to it's preceding char
* @param {ContextParams} charContextParams context params of a char
*/
function willConnectPrev(charContextParams) {
	var backtrack = [].concat(charContextParams.backtrack);
	for (var i = backtrack.length - 1; i >= 0; i--) {
		var prevChar = backtrack[i];
		var isolated = isIsolatedArabicChar(prevChar);
		var tashkeel = isTashkeelArabicChar(prevChar);
		if (!isolated && !tashkeel) return true;
		if (isolated) return false;
	}
	return false;
}
/**
* Check if a char can be connected to it's proceeding char
* @param {ContextParams} charContextParams context params of a char
*/
function willConnectNext(charContextParams) {
	if (isIsolatedArabicChar(charContextParams.current)) return false;
	for (var i = 0; i < charContextParams.lookahead.length; i++) {
		var nextChar = charContextParams.lookahead[i];
		if (!isTashkeelArabicChar(nextChar)) return true;
	}
	return false;
}
/**
* Apply arabic presentation forms to a list of tokens
* @param {ContextRange} range a range of tokens
*/
function arabicPresentationForms(range) {
	var this$1 = this;
	var script = "arab";
	var tags = this.featuresTags[script];
	var tokens = this.tokenizer.getRangeTokens(range);
	if (tokens.length === 1) return;
	var contextParams = new ContextParams(tokens.map(function(token) {
		return token.getState("glyphIndex");
	}), 0);
	var charContextParams = new ContextParams(tokens.map(function(token) {
		return token.char;
	}), 0);
	tokens.forEach(function(token, index) {
		if (isTashkeelArabicChar(token.char)) return;
		contextParams.setCurrentIndex(index);
		charContextParams.setCurrentIndex(index);
		var CONNECT = 0;
		if (willConnectPrev(charContextParams)) CONNECT |= 1;
		if (willConnectNext(charContextParams)) CONNECT |= 2;
		var tag;
		switch (CONNECT) {
			case 1:
				tag = "fina";
				break;
			case 2:
				tag = "init";
				break;
			case 3: tag = "medi";
		}
		if (tags.indexOf(tag) === -1) return;
		var substitutions = this$1.query.lookupFeature({
			tag,
			script,
			contextParams
		});
		if (substitutions instanceof Error) return console.info(substitutions.message);
		substitutions.forEach(function(action, index) {
			if (action instanceof SubstitutionAction) {
				applySubstitution(action, tokens, index);
				contextParams.context[index] = action.substitution;
			}
		});
	});
}
/**
* Apply Arabic required ligatures feature to a range of tokens
*/
/**
* Update context params
* @param {any} tokens a list of tokens
* @param {number} index current item index
*/
function getContextParams(tokens, index) {
	return new ContextParams(tokens.map(function(token) {
		return token.activeState.value;
	}), index || 0);
}
/**
* Apply Arabic required ligatures to a context range
* @param {ContextRange} range a range of tokens
*/
function arabicRequiredLigatures(range) {
	var this$1 = this;
	var script = "arab";
	var tokens = this.tokenizer.getRangeTokens(range);
	var contextParams = getContextParams(tokens);
	contextParams.context.forEach(function(glyphIndex, index) {
		contextParams.setCurrentIndex(index);
		var substitutions = this$1.query.lookupFeature({
			tag: "rlig",
			script,
			contextParams
		});
		if (substitutions.length) {
			substitutions.forEach(function(action) {
				return applySubstitution(action, tokens, index);
			});
			contextParams = getContextParams(tokens);
		}
	});
}
/**
* Latin word context checkers
*/
function latinWordStartCheck(contextParams) {
	var char = contextParams.current;
	var prevChar = contextParams.get(-1);
	return prevChar === null && isLatinChar(char) || !isLatinChar(prevChar) && isLatinChar(char);
}
function latinWordEndCheck(contextParams) {
	var nextChar = contextParams.get(1);
	return nextChar === null || !isLatinChar(nextChar);
}
var latinWordCheck = {
	startCheck: latinWordStartCheck,
	endCheck: latinWordEndCheck
};
/**
* Apply Latin ligature feature to a range of tokens
*/
/**
* Update context params
* @param {any} tokens a list of tokens
* @param {number} index current item index
*/
function getContextParams$1(tokens, index) {
	return new ContextParams(tokens.map(function(token) {
		return token.activeState.value;
	}), index || 0);
}
/**
* Apply Arabic required ligatures to a context range
* @param {ContextRange} range a range of tokens
*/
function latinLigature(range) {
	var this$1 = this;
	var script = "latn";
	var tokens = this.tokenizer.getRangeTokens(range);
	var contextParams = getContextParams$1(tokens);
	contextParams.context.forEach(function(glyphIndex, index) {
		contextParams.setCurrentIndex(index);
		var substitutions = this$1.query.lookupFeature({
			tag: "liga",
			script,
			contextParams
		});
		if (substitutions.length) {
			substitutions.forEach(function(action) {
				return applySubstitution(action, tokens, index);
			});
			contextParams = getContextParams$1(tokens);
		}
	});
}
/**
* Infer bidirectional properties for a given text and apply
* the corresponding layout rules.
*/
/**
* Create Bidi. features
* @param {string} baseDir text base direction. value either 'ltr' or 'rtl'
*/
function Bidi(baseDir) {
	this.baseDir = baseDir || "ltr";
	this.tokenizer = new Tokenizer();
	this.featuresTags = {};
}
/**
* Sets Bidi text
* @param {string} text a text input
*/
Bidi.prototype.setText = function(text) {
	this.text = text;
};
/**
* Store essential context checks:
* arabic word check for applying gsub features
* arabic sentence check for adjusting arabic layout
*/
Bidi.prototype.contextChecks = {
	latinWordCheck,
	arabicWordCheck,
	arabicSentenceCheck
};
/**
* Register arabic word check
*/
function registerContextChecker(checkId) {
	var check = this.contextChecks[checkId + "Check"];
	return this.tokenizer.registerContextChecker(checkId, check.startCheck, check.endCheck);
}
/**
* Perform pre tokenization procedure then
* tokenize text input
*/
function tokenizeText() {
	registerContextChecker.call(this, "latinWord");
	registerContextChecker.call(this, "arabicWord");
	registerContextChecker.call(this, "arabicSentence");
	return this.tokenizer.tokenize(this.text);
}
/**
* Reverse arabic sentence layout
* TODO: check base dir before applying adjustments - priority low
*/
function reverseArabicSentences() {
	var this$1 = this;
	this.tokenizer.getContextRanges("arabicSentence").forEach(function(range) {
		var rangeTokens = this$1.tokenizer.getRangeTokens(range);
		this$1.tokenizer.replaceRange(range.startIndex, range.endOffset, rangeTokens.reverse());
	});
}
/**
* Register supported features tags
* @param {script} script script tag
* @param {Array} tags features tags list
*/
Bidi.prototype.registerFeatures = function(script, tags) {
	var this$1 = this;
	var supportedTags = tags.filter(function(tag) {
		return this$1.query.supports({
			script,
			tag
		});
	});
	if (!this.featuresTags.hasOwnProperty(script)) this.featuresTags[script] = supportedTags;
	else this.featuresTags[script] = this.featuresTags[script].concat(supportedTags);
};
/**
* Apply GSUB features
* @param {Array} tagsList a list of features tags
* @param {string} script a script tag
* @param {Font} font opentype font instance
*/
Bidi.prototype.applyFeatures = function(font, features) {
	if (!font) throw new Error("No valid font was provided to apply features");
	if (!this.query) this.query = new FeatureQuery(font);
	for (var f = 0; f < features.length; f++) {
		var feature = features[f];
		if (!this.query.supports({ script: feature.script })) continue;
		this.registerFeatures(feature.script, feature.tags);
	}
};
/**
* Register a state modifier
* @param {string} modifierId state modifier id
* @param {function} condition a predicate function that returns true or false
* @param {function} modifier a modifier function to set token state
*/
Bidi.prototype.registerModifier = function(modifierId, condition, modifier) {
	this.tokenizer.registerModifier(modifierId, condition, modifier);
};
/**
* Check if 'glyphIndex' is registered
*/
function checkGlyphIndexStatus() {
	if (this.tokenizer.registeredModifiers.indexOf("glyphIndex") === -1) throw new Error("glyphIndex modifier is required to apply arabic presentation features.");
}
/**
* Apply arabic presentation forms features
*/
function applyArabicPresentationForms() {
	var this$1 = this;
	if (!this.featuresTags.hasOwnProperty("arab")) return;
	checkGlyphIndexStatus.call(this);
	this.tokenizer.getContextRanges("arabicWord").forEach(function(range) {
		arabicPresentationForms.call(this$1, range);
	});
}
/**
* Apply required arabic ligatures
*/
function applyArabicRequireLigatures() {
	var this$1 = this;
	var script = "arab";
	if (!this.featuresTags.hasOwnProperty(script)) return;
	if (this.featuresTags[script].indexOf("rlig") === -1) return;
	checkGlyphIndexStatus.call(this);
	this.tokenizer.getContextRanges("arabicWord").forEach(function(range) {
		arabicRequiredLigatures.call(this$1, range);
	});
}
/**
* Apply required arabic ligatures
*/
function applyLatinLigatures() {
	var this$1 = this;
	var script = "latn";
	if (!this.featuresTags.hasOwnProperty(script)) return;
	if (this.featuresTags[script].indexOf("liga") === -1) return;
	checkGlyphIndexStatus.call(this);
	this.tokenizer.getContextRanges("latinWord").forEach(function(range) {
		latinLigature.call(this$1, range);
	});
}
/**
* Check if a context is registered
* @param {string} contextId context id
*/
Bidi.prototype.checkContextReady = function(contextId) {
	return !!this.tokenizer.getContext(contextId);
};
/**
* Apply features to registered contexts
*/
Bidi.prototype.applyFeaturesToContexts = function() {
	if (this.checkContextReady("arabicWord")) {
		applyArabicPresentationForms.call(this);
		applyArabicRequireLigatures.call(this);
	}
	if (this.checkContextReady("latinWord")) applyLatinLigatures.call(this);
	if (this.checkContextReady("arabicSentence")) reverseArabicSentences.call(this);
};
/**
* process text input
* @param {string} text an input text
*/
Bidi.prototype.processText = function(text) {
	if (!this.text || this.text !== text) {
		this.setText(text);
		tokenizeText.call(this);
		this.applyFeaturesToContexts();
	}
};
/**
* Process a string of text to identify and adjust
* bidirectional text entities.
* @param {string} text input text
*/
Bidi.prototype.getBidiText = function(text) {
	this.processText(text);
	return this.tokenizer.getText();
};
/**
* Get the current state index of each token
* @param {text} text an input text
*/
Bidi.prototype.getTextGlyphs = function(text) {
	this.processText(text);
	var indexes = [];
	for (var i = 0; i < this.tokenizer.tokens.length; i++) {
		var token = this.tokenizer.tokens[i];
		if (token.state.deleted) continue;
		var index = token.activeState.value;
		indexes.push(Array.isArray(index) ? index[0] : index);
	}
	return indexes;
};
/**
* @typedef FontOptions
* @type Object
* @property {Boolean} empty - whether to create a new empty font
* @property {string} familyName
* @property {string} styleName
* @property {string=} fullName
* @property {string=} postScriptName
* @property {string=} designer
* @property {string=} designerURL
* @property {string=} manufacturer
* @property {string=} manufacturerURL
* @property {string=} license
* @property {string=} licenseURL
* @property {string=} version
* @property {string=} description
* @property {string=} copyright
* @property {string=} trademark
* @property {Number} unitsPerEm
* @property {Number} ascender
* @property {Number} descender
* @property {Number} createdTimestamp
* @property {string=} weightClass
* @property {string=} widthClass
* @property {string=} fsSelection
*/
/**
* A Font represents a loaded OpenType font file.
* It contains a set of glyphs and methods to draw text on a drawing context,
* or to get a path representing the text.
* @exports opentype.Font
* @class
* @param {FontOptions}
* @constructor
*/
function Font(options) {
	options = options || {};
	options.tables = options.tables || {};
	if (!options.empty) {
		checkArgument(options.familyName, "When creating a new Font object, familyName is required.");
		checkArgument(options.styleName, "When creating a new Font object, styleName is required.");
		checkArgument(options.unitsPerEm, "When creating a new Font object, unitsPerEm is required.");
		checkArgument(options.ascender, "When creating a new Font object, ascender is required.");
		checkArgument(options.descender <= 0, "When creating a new Font object, negative descender value is required.");
		this.unitsPerEm = options.unitsPerEm || 1e3;
		this.ascender = options.ascender;
		this.descender = options.descender;
		this.createdTimestamp = options.createdTimestamp;
		this.tables = Object.assign(options.tables, { os2: Object.assign({
			usWeightClass: options.weightClass || this.usWeightClasses.MEDIUM,
			usWidthClass: options.widthClass || this.usWidthClasses.MEDIUM,
			fsSelection: options.fsSelection || this.fsSelectionValues.REGULAR
		}, options.tables.os2) });
	}
	this.supported = true;
	this.glyphs = new glyphset.GlyphSet(this, options.glyphs || []);
	this.encoding = new DefaultEncoding(this);
	this.position = new Position(this);
	this.substitution = new Substitution(this);
	this.tables = this.tables || {};
	this._push = null;
	this._hmtxTableData = {};
	Object.defineProperty(this, "hinting", { get: function() {
		if (this._hinting) return this._hinting;
		if (this.outlinesFormat === "truetype") return this._hinting = new Hinting(this);
	} });
}
/**
* Check if the font has a glyph for the given character.
* @param  {string}
* @return {Boolean}
*/
Font.prototype.hasChar = function(c) {
	return this.encoding.charToGlyphIndex(c) !== null;
};
/**
* Convert the given character to a single glyph index.
* Note that this function assumes that there is a one-to-one mapping between
* the given character and a glyph; for complex scripts this might not be the case.
* @param  {string}
* @return {Number}
*/
Font.prototype.charToGlyphIndex = function(s) {
	return this.encoding.charToGlyphIndex(s);
};
/**
* Convert the given character to a single Glyph object.
* Note that this function assumes that there is a one-to-one mapping between
* the given character and a glyph; for complex scripts this might not be the case.
* @param  {string}
* @return {opentype.Glyph}
*/
Font.prototype.charToGlyph = function(c) {
	var glyphIndex = this.charToGlyphIndex(c);
	var glyph = this.glyphs.get(glyphIndex);
	if (!glyph) glyph = this.glyphs.get(0);
	return glyph;
};
/**
* Update features
* @param {any} options features options
*/
Font.prototype.updateFeatures = function(options) {
	return this.defaultRenderOptions.features.map(function(feature) {
		if (feature.script === "latn") return {
			script: "latn",
			tags: feature.tags.filter(function(tag) {
				return options[tag];
			})
		};
		else return feature;
	});
};
/**
* Convert the given text to a list of Glyph objects.
* Note that there is no strict one-to-one mapping between characters and
* glyphs, so the list of returned glyphs can be larger or smaller than the
* length of the given string.
* @param  {string}
* @param  {GlyphRenderOptions} [options]
* @return {opentype.Glyph[]}
*/
Font.prototype.stringToGlyphs = function(s, options) {
	var this$1 = this;
	var bidi = new Bidi();
	var charToGlyphIndexMod = function(token) {
		return this$1.charToGlyphIndex(token.char);
	};
	bidi.registerModifier("glyphIndex", null, charToGlyphIndexMod);
	var features = options ? this.updateFeatures(options.features) : this.defaultRenderOptions.features;
	bidi.applyFeatures(this, features);
	var indexes = bidi.getTextGlyphs(s);
	var length = indexes.length;
	var glyphs = new Array(length);
	var notdef = this.glyphs.get(0);
	for (var i = 0; i < length; i += 1) glyphs[i] = this.glyphs.get(indexes[i]) || notdef;
	return glyphs;
};
/**
* Retrieve the value of the kerning pair between the left glyph (or its index)
* and the right glyph (or its index). If no kerning pair is found, return 0.
* The kerning value gets added to the advance width when calculating the spacing
* between glyphs.
* For GPOS kerning, this method uses the default script and language, which covers
* most use cases. To have greater control, use font.position.getKerningValue .
* @param  {opentype.Glyph} leftGlyph
* @param  {opentype.Glyph} rightGlyph
* @return {Number}
*/
Font.prototype.getKerningValue = function(leftGlyph, rightGlyph) {
	leftGlyph = leftGlyph.index || leftGlyph;
	rightGlyph = rightGlyph.index || rightGlyph;
	var gposKerning = this.position.defaultKerningTables;
	if (gposKerning) return this.position.getKerningValue(gposKerning, leftGlyph, rightGlyph);
	return this.kerningPairs[leftGlyph + "," + rightGlyph] || 0;
};
/**
* @typedef GlyphRenderOptions
* @type Object
* @property {string} [script] - script used to determine which features to apply. By default, 'DFLT' or 'latn' is used.
*                               See https://www.microsoft.com/typography/otspec/scripttags.htm
* @property {string} [language='dflt'] - language system used to determine which features to apply.
*                                        See https://www.microsoft.com/typography/developers/opentype/languagetags.aspx
* @property {boolean} [kerning=true] - whether to include kerning values
* @property {object} [features] - OpenType Layout feature tags. Used to enable or disable the features of the given script/language system.
*                                 See https://www.microsoft.com/typography/otspec/featuretags.htm
*/
Font.prototype.defaultRenderOptions = {
	kerning: true,
	features: [(
	/**
	* these 4 features are required to render Arabic text properly
	* and shouldn't be turned off when rendering arabic text.
	*/
	{
		script: "arab",
		tags: [
			"init",
			"medi",
			"fina",
			"rlig"
		]
	}), {
		script: "latn",
		tags: ["liga", "rlig"]
	}]
};
/**
* Helper function that invokes the given callback for each glyph in the given text.
* The callback gets `(glyph, x, y, fontSize, options)`.* @param  {string} text
* @param {string} text - The text to apply.
* @param  {number} [x=0] - Horizontal position of the beginning of the text.
* @param  {number} [y=0] - Vertical position of the *baseline* of the text.
* @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
* @param  {GlyphRenderOptions=} options
* @param  {Function} callback
*/
Font.prototype.forEachGlyph = function(text, x, y, fontSize, options, callback) {
	x = x !== void 0 ? x : 0;
	y = y !== void 0 ? y : 0;
	fontSize = fontSize !== void 0 ? fontSize : 72;
	options = Object.assign({}, this.defaultRenderOptions, options);
	var fontScale = 1 / this.unitsPerEm * fontSize;
	var glyphs = this.stringToGlyphs(text, options);
	var kerningLookups;
	if (options.kerning) {
		var script = options.script || this.position.getDefaultScriptName();
		kerningLookups = this.position.getKerningTables(script, options.language);
	}
	for (var i = 0; i < glyphs.length; i += 1) {
		var glyph = glyphs[i];
		callback.call(this, glyph, x, y, fontSize, options);
		if (glyph.advanceWidth) x += glyph.advanceWidth * fontScale;
		if (options.kerning && i < glyphs.length - 1) {
			var kerningValue = kerningLookups ? this.position.getKerningValue(kerningLookups, glyph.index, glyphs[i + 1].index) : this.getKerningValue(glyph, glyphs[i + 1]);
			x += kerningValue * fontScale;
		}
		if (options.letterSpacing) x += options.letterSpacing * fontSize;
		else if (options.tracking) x += options.tracking / 1e3 * fontSize;
	}
	return x;
};
/**
* Create a Path object that represents the given text.
* @param  {string} text - The text to create.
* @param  {number} [x=0] - Horizontal position of the beginning of the text.
* @param  {number} [y=0] - Vertical position of the *baseline* of the text.
* @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
* @param  {GlyphRenderOptions=} options
* @return {opentype.Path}
*/
Font.prototype.getPath = function(text, x, y, fontSize, options) {
	var fullPath = new Path();
	this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
		var glyphPath = glyph.getPath(gX, gY, gFontSize, options, this);
		fullPath.extend(glyphPath);
	});
	return fullPath;
};
/**
* Create an array of Path objects that represent the glyphs of a given text.
* @param  {string} text - The text to create.
* @param  {number} [x=0] - Horizontal position of the beginning of the text.
* @param  {number} [y=0] - Vertical position of the *baseline* of the text.
* @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
* @param  {GlyphRenderOptions=} options
* @return {opentype.Path[]}
*/
Font.prototype.getPaths = function(text, x, y, fontSize, options) {
	var glyphPaths = [];
	this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
		var glyphPath = glyph.getPath(gX, gY, gFontSize, options, this);
		glyphPaths.push(glyphPath);
	});
	return glyphPaths;
};
/**
* Returns the advance width of a text.
*
* This is something different than Path.getBoundingBox() as for example a
* suffixed whitespace increases the advanceWidth but not the bounding box
* or an overhanging letter like a calligraphic 'f' might have a quite larger
* bounding box than its advance width.
*
* This corresponds to canvas2dContext.measureText(text).width
*
* @param  {string} text - The text to create.
* @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
* @param  {GlyphRenderOptions=} options
* @return advance width
*/
Font.prototype.getAdvanceWidth = function(text, fontSize, options) {
	return this.forEachGlyph(text, 0, 0, fontSize, options, function() {});
};
/**
* @private
*/
Font.prototype.fsSelectionValues = {
	ITALIC: 1,
	UNDERSCORE: 2,
	NEGATIVE: 4,
	OUTLINED: 8,
	STRIKEOUT: 16,
	BOLD: 32,
	REGULAR: 64,
	USER_TYPO_METRICS: 128,
	WWS: 256,
	OBLIQUE: 512
};
/**
* @private
*/
Font.prototype.usWidthClasses = {
	ULTRA_CONDENSED: 1,
	EXTRA_CONDENSED: 2,
	CONDENSED: 3,
	SEMI_CONDENSED: 4,
	MEDIUM: 5,
	SEMI_EXPANDED: 6,
	EXPANDED: 7,
	EXTRA_EXPANDED: 8,
	ULTRA_EXPANDED: 9
};
/**
* @private
*/
Font.prototype.usWeightClasses = {
	THIN: 100,
	EXTRA_LIGHT: 200,
	LIGHT: 300,
	NORMAL: 400,
	MEDIUM: 500,
	SEMI_BOLD: 600,
	BOLD: 700,
	EXTRA_BOLD: 800,
	BLACK: 900
};
function parseCmapTableFormat12(cmap, p) {
	p.parseUShort();
	cmap.length = p.parseULong();
	cmap.language = p.parseULong();
	var groupCount;
	cmap.groupCount = groupCount = p.parseULong();
	cmap.glyphIndexMap = {};
	for (var i = 0; i < groupCount; i += 1) {
		var startCharCode = p.parseULong();
		var endCharCode = p.parseULong();
		var startGlyphId = p.parseULong();
		for (var c = startCharCode; c <= endCharCode; c += 1) {
			cmap.glyphIndexMap[c] = startGlyphId;
			startGlyphId++;
		}
	}
}
function parseCmapTableFormat4(cmap, p, data, start, offset) {
	cmap.length = p.parseUShort();
	cmap.language = p.parseUShort();
	var segCount;
	cmap.segCount = segCount = p.parseUShort() >> 1;
	p.skip("uShort", 3);
	cmap.glyphIndexMap = {};
	var endCountParser = new parse.Parser(data, start + offset + 14);
	var startCountParser = new parse.Parser(data, start + offset + 16 + segCount * 2);
	var idDeltaParser = new parse.Parser(data, start + offset + 16 + segCount * 4);
	var idRangeOffsetParser = new parse.Parser(data, start + offset + 16 + segCount * 6);
	var glyphIndexOffset = start + offset + 16 + segCount * 8;
	for (var i = 0; i < segCount - 1; i += 1) {
		var glyphIndex = void 0;
		var endCount = endCountParser.parseUShort();
		var startCount = startCountParser.parseUShort();
		var idDelta = idDeltaParser.parseShort();
		var idRangeOffset = idRangeOffsetParser.parseUShort();
		for (var c = startCount; c <= endCount; c += 1) {
			if (idRangeOffset !== 0) {
				glyphIndexOffset = idRangeOffsetParser.offset + idRangeOffsetParser.relativeOffset - 2;
				glyphIndexOffset += idRangeOffset;
				glyphIndexOffset += (c - startCount) * 2;
				glyphIndex = parse.getUShort(data, glyphIndexOffset);
				if (glyphIndex !== 0) glyphIndex = glyphIndex + idDelta & 65535;
			} else glyphIndex = c + idDelta & 65535;
			cmap.glyphIndexMap[c] = glyphIndex;
		}
	}
}
function parseCmapTable(data, start) {
	var cmap = {};
	cmap.version = parse.getUShort(data, start);
	check.argument(cmap.version === 0, "cmap table version should be 0.");
	cmap.numTables = parse.getUShort(data, start + 2);
	var offset = -1;
	for (var i = cmap.numTables - 1; i >= 0; i -= 1) {
		var platformId = parse.getUShort(data, start + 4 + i * 8);
		var encodingId = parse.getUShort(data, start + 4 + i * 8 + 2);
		if (platformId === 3 && (encodingId === 0 || encodingId === 1 || encodingId === 10) || platformId === 0 && (encodingId === 0 || encodingId === 1 || encodingId === 2 || encodingId === 3 || encodingId === 4)) {
			offset = parse.getULong(data, start + 4 + i * 8 + 4);
			break;
		}
	}
	if (offset === -1) throw new Error("No valid cmap sub-tables found.");
	var p = new parse.Parser(data, start + offset);
	cmap.format = p.parseUShort();
	if (cmap.format === 12) parseCmapTableFormat12(cmap, p);
	else if (cmap.format === 4) parseCmapTableFormat4(cmap, p, data, start, offset);
	else throw new Error("Only format 4 and 12 cmap tables are supported (found format " + cmap.format + ").");
	return cmap;
}
var cmap = { parse: parseCmapTable };
function calcCFFSubroutineBias(subrs) {
	var bias;
	if (subrs.length < 1240) bias = 107;
	else if (subrs.length < 33900) bias = 1131;
	else bias = 32768;
	return bias;
}
function parseCFFIndex(data, start, conversionFn) {
	var offsets = [];
	var objects = [];
	var count = parse.getCard16(data, start);
	var objectOffset;
	var endOffset;
	if (count !== 0) {
		var offsetSize = parse.getByte(data, start + 2);
		objectOffset = start + (count + 1) * offsetSize + 2;
		var pos = start + 3;
		for (var i = 0; i < count + 1; i += 1) {
			offsets.push(parse.getOffset(data, pos, offsetSize));
			pos += offsetSize;
		}
		endOffset = objectOffset + offsets[count];
	} else endOffset = start + 2;
	for (var i$1 = 0; i$1 < offsets.length - 1; i$1 += 1) {
		var value = parse.getBytes(data, objectOffset + offsets[i$1], objectOffset + offsets[i$1 + 1]);
		if (conversionFn) value = conversionFn(value);
		objects.push(value);
	}
	return {
		objects,
		startOffset: start,
		endOffset
	};
}
function parseCFFIndexLowMemory(data, start) {
	var offsets = [];
	var count = parse.getCard16(data, start);
	var objectOffset;
	var endOffset;
	if (count !== 0) {
		var offsetSize = parse.getByte(data, start + 2);
		objectOffset = start + (count + 1) * offsetSize + 2;
		var pos = start + 3;
		for (var i = 0; i < count + 1; i += 1) {
			offsets.push(parse.getOffset(data, pos, offsetSize));
			pos += offsetSize;
		}
		endOffset = objectOffset + offsets[count];
	} else endOffset = start + 2;
	return {
		offsets,
		startOffset: start,
		endOffset
	};
}
function getCffIndexObject(i, offsets, data, start, conversionFn) {
	var count = parse.getCard16(data, start);
	var objectOffset = 0;
	if (count !== 0) {
		var offsetSize = parse.getByte(data, start + 2);
		objectOffset = start + (count + 1) * offsetSize + 2;
	}
	var value = parse.getBytes(data, objectOffset + offsets[i], objectOffset + offsets[i + 1]);
	if (conversionFn) value = conversionFn(value);
	return value;
}
function parseFloatOperand(parser) {
	var s = "";
	var eof = 15;
	var lookup = [
		"0",
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		".",
		"E",
		"E-",
		null,
		"-"
	];
	while (true) {
		var b = parser.parseByte();
		var n1 = b >> 4;
		var n2 = b & 15;
		if (n1 === eof) break;
		s += lookup[n1];
		if (n2 === eof) break;
		s += lookup[n2];
	}
	return parseFloat(s);
}
function parseOperand(parser, b0) {
	var b1;
	var b2;
	var b3;
	var b4;
	if (b0 === 28) {
		b1 = parser.parseByte();
		b2 = parser.parseByte();
		return b1 << 8 | b2;
	}
	if (b0 === 29) {
		b1 = parser.parseByte();
		b2 = parser.parseByte();
		b3 = parser.parseByte();
		b4 = parser.parseByte();
		return b1 << 24 | b2 << 16 | b3 << 8 | b4;
	}
	if (b0 === 30) return parseFloatOperand(parser);
	if (b0 >= 32 && b0 <= 246) return b0 - 139;
	if (b0 >= 247 && b0 <= 250) {
		b1 = parser.parseByte();
		return (b0 - 247) * 256 + b1 + 108;
	}
	if (b0 >= 251 && b0 <= 254) {
		b1 = parser.parseByte();
		return -(b0 - 251) * 256 - b1 - 108;
	}
	throw new Error("Invalid b0 " + b0);
}
function entriesToObject(entries) {
	var o = {};
	for (var i = 0; i < entries.length; i += 1) {
		var key = entries[i][0];
		var values = entries[i][1];
		var value = void 0;
		if (values.length === 1) value = values[0];
		else value = values;
		if (o.hasOwnProperty(key) && !isNaN(o[key])) throw new Error("Object " + o + " already has key " + key);
		o[key] = value;
	}
	return o;
}
function parseCFFDict(data, start, size) {
	start = start !== void 0 ? start : 0;
	var parser = new parse.Parser(data, start);
	var entries = [];
	var operands = [];
	size = size !== void 0 ? size : data.length;
	while (parser.relativeOffset < size) {
		var op = parser.parseByte();
		if (op <= 21) {
			if (op === 12) op = 1200 + parser.parseByte();
			entries.push([op, operands]);
			operands = [];
		} else operands.push(parseOperand(parser, op));
	}
	return entriesToObject(entries);
}
function getCFFString(strings, index) {
	if (index <= 390) index = cffStandardStrings[index];
	else index = strings[index - 391];
	return index;
}
function interpretDict(dict, meta, strings) {
	var newDict = {};
	var value;
	for (var i = 0; i < meta.length; i += 1) {
		var m = meta[i];
		if (Array.isArray(m.type)) {
			var values = [];
			values.length = m.type.length;
			for (var j = 0; j < m.type.length; j++) {
				value = dict[m.op] !== void 0 ? dict[m.op][j] : void 0;
				if (value === void 0) value = m.value !== void 0 && m.value[j] !== void 0 ? m.value[j] : null;
				if (m.type[j] === "SID") value = getCFFString(strings, value);
				values[j] = value;
			}
			newDict[m.name] = values;
		} else {
			value = dict[m.op];
			if (value === void 0) value = m.value !== void 0 ? m.value : null;
			if (m.type === "SID") value = getCFFString(strings, value);
			newDict[m.name] = value;
		}
	}
	return newDict;
}
function parseCFFHeader(data, start) {
	var header = {};
	header.formatMajor = parse.getCard8(data, start);
	header.formatMinor = parse.getCard8(data, start + 1);
	header.size = parse.getCard8(data, start + 2);
	header.offsetSize = parse.getCard8(data, start + 3);
	header.startOffset = start;
	header.endOffset = start + 4;
	return header;
}
var TOP_DICT_META = [
	{
		name: "version",
		op: 0,
		type: "SID"
	},
	{
		name: "notice",
		op: 1,
		type: "SID"
	},
	{
		name: "copyright",
		op: 1200,
		type: "SID"
	},
	{
		name: "fullName",
		op: 2,
		type: "SID"
	},
	{
		name: "familyName",
		op: 3,
		type: "SID"
	},
	{
		name: "weight",
		op: 4,
		type: "SID"
	},
	{
		name: "isFixedPitch",
		op: 1201,
		type: "number",
		value: 0
	},
	{
		name: "italicAngle",
		op: 1202,
		type: "number",
		value: 0
	},
	{
		name: "underlinePosition",
		op: 1203,
		type: "number",
		value: -100
	},
	{
		name: "underlineThickness",
		op: 1204,
		type: "number",
		value: 50
	},
	{
		name: "paintType",
		op: 1205,
		type: "number",
		value: 0
	},
	{
		name: "charstringType",
		op: 1206,
		type: "number",
		value: 2
	},
	{
		name: "fontMatrix",
		op: 1207,
		type: [
			"real",
			"real",
			"real",
			"real",
			"real",
			"real"
		],
		value: [
			.001,
			0,
			0,
			.001,
			0,
			0
		]
	},
	{
		name: "uniqueId",
		op: 13,
		type: "number"
	},
	{
		name: "fontBBox",
		op: 5,
		type: [
			"number",
			"number",
			"number",
			"number"
		],
		value: [
			0,
			0,
			0,
			0
		]
	},
	{
		name: "strokeWidth",
		op: 1208,
		type: "number",
		value: 0
	},
	{
		name: "xuid",
		op: 14,
		type: [],
		value: null
	},
	{
		name: "charset",
		op: 15,
		type: "offset",
		value: 0
	},
	{
		name: "encoding",
		op: 16,
		type: "offset",
		value: 0
	},
	{
		name: "charStrings",
		op: 17,
		type: "offset",
		value: 0
	},
	{
		name: "private",
		op: 18,
		type: ["number", "offset"],
		value: [0, 0]
	},
	{
		name: "ros",
		op: 1230,
		type: [
			"SID",
			"SID",
			"number"
		]
	},
	{
		name: "cidFontVersion",
		op: 1231,
		type: "number",
		value: 0
	},
	{
		name: "cidFontRevision",
		op: 1232,
		type: "number",
		value: 0
	},
	{
		name: "cidFontType",
		op: 1233,
		type: "number",
		value: 0
	},
	{
		name: "cidCount",
		op: 1234,
		type: "number",
		value: 8720
	},
	{
		name: "uidBase",
		op: 1235,
		type: "number"
	},
	{
		name: "fdArray",
		op: 1236,
		type: "offset"
	},
	{
		name: "fdSelect",
		op: 1237,
		type: "offset"
	},
	{
		name: "fontName",
		op: 1238,
		type: "SID"
	}
];
var PRIVATE_DICT_META = [
	{
		name: "subrs",
		op: 19,
		type: "offset",
		value: 0
	},
	{
		name: "defaultWidthX",
		op: 20,
		type: "number",
		value: 0
	},
	{
		name: "nominalWidthX",
		op: 21,
		type: "number",
		value: 0
	}
];
function parseCFFTopDict(data, strings) {
	return interpretDict(parseCFFDict(data, 0, data.byteLength), TOP_DICT_META, strings);
}
function parseCFFPrivateDict(data, start, size, strings) {
	return interpretDict(parseCFFDict(data, start, size), PRIVATE_DICT_META, strings);
}
function gatherCFFTopDicts(data, start, cffIndex, strings) {
	var topDictArray = [];
	for (var iTopDict = 0; iTopDict < cffIndex.length; iTopDict += 1) {
		var topDict = parseCFFTopDict(new DataView(new Uint8Array(cffIndex[iTopDict]).buffer), strings);
		topDict._subrs = [];
		topDict._subrsBias = 0;
		topDict._defaultWidthX = 0;
		topDict._nominalWidthX = 0;
		var privateSize = topDict.private[0];
		var privateOffset = topDict.private[1];
		if (privateSize !== 0 && privateOffset !== 0) {
			var privateDict = parseCFFPrivateDict(data, privateOffset + start, privateSize, strings);
			topDict._defaultWidthX = privateDict.defaultWidthX;
			topDict._nominalWidthX = privateDict.nominalWidthX;
			if (privateDict.subrs !== 0) {
				topDict._subrs = parseCFFIndex(data, privateOffset + privateDict.subrs + start).objects;
				topDict._subrsBias = calcCFFSubroutineBias(topDict._subrs);
			}
			topDict._privateDict = privateDict;
		}
		topDictArray.push(topDict);
	}
	return topDictArray;
}
function parseCFFCharset(data, start, nGlyphs, strings) {
	var sid;
	var count;
	var parser = new parse.Parser(data, start);
	nGlyphs -= 1;
	var charset = [".notdef"];
	var format = parser.parseCard8();
	if (format === 0) for (var i = 0; i < nGlyphs; i += 1) {
		sid = parser.parseSID();
		charset.push(getCFFString(strings, sid));
	}
	else if (format === 1) while (charset.length <= nGlyphs) {
		sid = parser.parseSID();
		count = parser.parseCard8();
		for (var i$1 = 0; i$1 <= count; i$1 += 1) {
			charset.push(getCFFString(strings, sid));
			sid += 1;
		}
	}
	else if (format === 2) while (charset.length <= nGlyphs) {
		sid = parser.parseSID();
		count = parser.parseCard16();
		for (var i$2 = 0; i$2 <= count; i$2 += 1) {
			charset.push(getCFFString(strings, sid));
			sid += 1;
		}
	}
	else throw new Error("Unknown charset format " + format);
	return charset;
}
function parseCFFEncoding(data, start, charset) {
	var code;
	var enc = {};
	var parser = new parse.Parser(data, start);
	var format = parser.parseCard8();
	if (format === 0) {
		var nCodes = parser.parseCard8();
		for (var i = 0; i < nCodes; i += 1) {
			code = parser.parseCard8();
			enc[code] = i;
		}
	} else if (format === 1) {
		var nRanges = parser.parseCard8();
		code = 1;
		for (var i$1 = 0; i$1 < nRanges; i$1 += 1) {
			var first = parser.parseCard8();
			var nLeft = parser.parseCard8();
			for (var j = first; j <= first + nLeft; j += 1) {
				enc[j] = code;
				code += 1;
			}
		}
	} else throw new Error("Unknown encoding format " + format);
	return new CffEncoding(enc, charset);
}
function parseCFFCharstring(font, glyph, code) {
	var c1x;
	var c1y;
	var c2x;
	var c2y;
	var p = new Path();
	var stack = [];
	var nStems = 0;
	var haveWidth = false;
	var open = false;
	var x = 0;
	var y = 0;
	var subrs;
	var subrsBias;
	var defaultWidthX;
	var nominalWidthX;
	if (font.isCIDFont) {
		var fdIndex = font.tables.cff.topDict._fdSelect[glyph.index];
		var fdDict = font.tables.cff.topDict._fdArray[fdIndex];
		subrs = fdDict._subrs;
		subrsBias = fdDict._subrsBias;
		defaultWidthX = fdDict._defaultWidthX;
		nominalWidthX = fdDict._nominalWidthX;
	} else {
		subrs = font.tables.cff.topDict._subrs;
		subrsBias = font.tables.cff.topDict._subrsBias;
		defaultWidthX = font.tables.cff.topDict._defaultWidthX;
		nominalWidthX = font.tables.cff.topDict._nominalWidthX;
	}
	var width = defaultWidthX;
	function newContour(x, y) {
		if (open) p.closePath();
		p.moveTo(x, y);
		open = true;
	}
	function parseStems() {
		if (stack.length % 2 !== 0 && !haveWidth) width = stack.shift() + nominalWidthX;
		nStems += stack.length >> 1;
		stack.length = 0;
		haveWidth = true;
	}
	function parse(code) {
		var b1;
		var b2;
		var b3;
		var b4;
		var codeIndex;
		var subrCode;
		var jpx;
		var jpy;
		var c3x;
		var c3y;
		var c4x;
		var c4y;
		var i = 0;
		while (i < code.length) {
			var v = code[i];
			i += 1;
			switch (v) {
				case 1:
					parseStems();
					break;
				case 3:
					parseStems();
					break;
				case 4:
					if (stack.length > 1 && !haveWidth) {
						width = stack.shift() + nominalWidthX;
						haveWidth = true;
					}
					y += stack.pop();
					newContour(x, y);
					break;
				case 5:
					while (stack.length > 0) {
						x += stack.shift();
						y += stack.shift();
						p.lineTo(x, y);
					}
					break;
				case 6:
					while (stack.length > 0) {
						x += stack.shift();
						p.lineTo(x, y);
						if (stack.length === 0) break;
						y += stack.shift();
						p.lineTo(x, y);
					}
					break;
				case 7:
					while (stack.length > 0) {
						y += stack.shift();
						p.lineTo(x, y);
						if (stack.length === 0) break;
						x += stack.shift();
						p.lineTo(x, y);
					}
					break;
				case 8:
					while (stack.length > 0) {
						c1x = x + stack.shift();
						c1y = y + stack.shift();
						c2x = c1x + stack.shift();
						c2y = c1y + stack.shift();
						x = c2x + stack.shift();
						y = c2y + stack.shift();
						p.curveTo(c1x, c1y, c2x, c2y, x, y);
					}
					break;
				case 10:
					codeIndex = stack.pop() + subrsBias;
					subrCode = subrs[codeIndex];
					if (subrCode) parse(subrCode);
					break;
				case 11: return;
				case 12:
					v = code[i];
					i += 1;
					switch (v) {
						case 35:
							c1x = x + stack.shift();
							c1y = y + stack.shift();
							c2x = c1x + stack.shift();
							c2y = c1y + stack.shift();
							jpx = c2x + stack.shift();
							jpy = c2y + stack.shift();
							c3x = jpx + stack.shift();
							c3y = jpy + stack.shift();
							c4x = c3x + stack.shift();
							c4y = c3y + stack.shift();
							x = c4x + stack.shift();
							y = c4y + stack.shift();
							stack.shift();
							p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
							p.curveTo(c3x, c3y, c4x, c4y, x, y);
							break;
						case 34:
							c1x = x + stack.shift();
							c1y = y;
							c2x = c1x + stack.shift();
							c2y = c1y + stack.shift();
							jpx = c2x + stack.shift();
							jpy = c2y;
							c3x = jpx + stack.shift();
							c3y = c2y;
							c4x = c3x + stack.shift();
							c4y = y;
							x = c4x + stack.shift();
							p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
							p.curveTo(c3x, c3y, c4x, c4y, x, y);
							break;
						case 36:
							c1x = x + stack.shift();
							c1y = y + stack.shift();
							c2x = c1x + stack.shift();
							c2y = c1y + stack.shift();
							jpx = c2x + stack.shift();
							jpy = c2y;
							c3x = jpx + stack.shift();
							c3y = c2y;
							c4x = c3x + stack.shift();
							c4y = c3y + stack.shift();
							x = c4x + stack.shift();
							p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
							p.curveTo(c3x, c3y, c4x, c4y, x, y);
							break;
						case 37:
							c1x = x + stack.shift();
							c1y = y + stack.shift();
							c2x = c1x + stack.shift();
							c2y = c1y + stack.shift();
							jpx = c2x + stack.shift();
							jpy = c2y + stack.shift();
							c3x = jpx + stack.shift();
							c3y = jpy + stack.shift();
							c4x = c3x + stack.shift();
							c4y = c3y + stack.shift();
							if (Math.abs(c4x - x) > Math.abs(c4y - y)) x = c4x + stack.shift();
							else y = c4y + stack.shift();
							p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
							p.curveTo(c3x, c3y, c4x, c4y, x, y);
							break;
						default:
							console.log("Glyph " + glyph.index + ": unknown operator 1200" + v);
							stack.length = 0;
					}
					break;
				case 14:
					if (stack.length > 0 && !haveWidth) {
						width = stack.shift() + nominalWidthX;
						haveWidth = true;
					}
					if (open) {
						p.closePath();
						open = false;
					}
					break;
				case 18:
					parseStems();
					break;
				case 19:
				case 20:
					parseStems();
					i += nStems + 7 >> 3;
					break;
				case 21:
					if (stack.length > 2 && !haveWidth) {
						width = stack.shift() + nominalWidthX;
						haveWidth = true;
					}
					y += stack.pop();
					x += stack.pop();
					newContour(x, y);
					break;
				case 22:
					if (stack.length > 1 && !haveWidth) {
						width = stack.shift() + nominalWidthX;
						haveWidth = true;
					}
					x += stack.pop();
					newContour(x, y);
					break;
				case 23:
					parseStems();
					break;
				case 24:
					while (stack.length > 2) {
						c1x = x + stack.shift();
						c1y = y + stack.shift();
						c2x = c1x + stack.shift();
						c2y = c1y + stack.shift();
						x = c2x + stack.shift();
						y = c2y + stack.shift();
						p.curveTo(c1x, c1y, c2x, c2y, x, y);
					}
					x += stack.shift();
					y += stack.shift();
					p.lineTo(x, y);
					break;
				case 25:
					while (stack.length > 6) {
						x += stack.shift();
						y += stack.shift();
						p.lineTo(x, y);
					}
					c1x = x + stack.shift();
					c1y = y + stack.shift();
					c2x = c1x + stack.shift();
					c2y = c1y + stack.shift();
					x = c2x + stack.shift();
					y = c2y + stack.shift();
					p.curveTo(c1x, c1y, c2x, c2y, x, y);
					break;
				case 26:
					if (stack.length % 2) x += stack.shift();
					while (stack.length > 0) {
						c1x = x;
						c1y = y + stack.shift();
						c2x = c1x + stack.shift();
						c2y = c1y + stack.shift();
						x = c2x;
						y = c2y + stack.shift();
						p.curveTo(c1x, c1y, c2x, c2y, x, y);
					}
					break;
				case 27:
					if (stack.length % 2) y += stack.shift();
					while (stack.length > 0) {
						c1x = x + stack.shift();
						c1y = y;
						c2x = c1x + stack.shift();
						c2y = c1y + stack.shift();
						x = c2x + stack.shift();
						y = c2y;
						p.curveTo(c1x, c1y, c2x, c2y, x, y);
					}
					break;
				case 28:
					b1 = code[i];
					b2 = code[i + 1];
					stack.push((b1 << 24 | b2 << 16) >> 16);
					i += 2;
					break;
				case 29:
					codeIndex = stack.pop() + font.gsubrsBias;
					subrCode = font.gsubrs[codeIndex];
					if (subrCode) parse(subrCode);
					break;
				case 30:
					while (stack.length > 0) {
						c1x = x;
						c1y = y + stack.shift();
						c2x = c1x + stack.shift();
						c2y = c1y + stack.shift();
						x = c2x + stack.shift();
						y = c2y + (stack.length === 1 ? stack.shift() : 0);
						p.curveTo(c1x, c1y, c2x, c2y, x, y);
						if (stack.length === 0) break;
						c1x = x + stack.shift();
						c1y = y;
						c2x = c1x + stack.shift();
						c2y = c1y + stack.shift();
						y = c2y + stack.shift();
						x = c2x + (stack.length === 1 ? stack.shift() : 0);
						p.curveTo(c1x, c1y, c2x, c2y, x, y);
					}
					break;
				case 31:
					while (stack.length > 0) {
						c1x = x + stack.shift();
						c1y = y;
						c2x = c1x + stack.shift();
						c2y = c1y + stack.shift();
						y = c2y + stack.shift();
						x = c2x + (stack.length === 1 ? stack.shift() : 0);
						p.curveTo(c1x, c1y, c2x, c2y, x, y);
						if (stack.length === 0) break;
						c1x = x;
						c1y = y + stack.shift();
						c2x = c1x + stack.shift();
						c2y = c1y + stack.shift();
						x = c2x + stack.shift();
						y = c2y + (stack.length === 1 ? stack.shift() : 0);
						p.curveTo(c1x, c1y, c2x, c2y, x, y);
					}
					break;
				default: if (v < 32) console.log("Glyph " + glyph.index + ": unknown operator " + v);
				else if (v < 247) stack.push(v - 139);
				else if (v < 251) {
					b1 = code[i];
					i += 1;
					stack.push((v - 247) * 256 + b1 + 108);
				} else if (v < 255) {
					b1 = code[i];
					i += 1;
					stack.push(-(v - 251) * 256 - b1 - 108);
				} else {
					b1 = code[i];
					b2 = code[i + 1];
					b3 = code[i + 2];
					b4 = code[i + 3];
					i += 4;
					stack.push((b1 << 24 | b2 << 16 | b3 << 8 | b4) / 65536);
				}
			}
		}
	}
	parse(code);
	glyph.advanceWidth = width;
	return p;
}
function parseCFFFDSelect(data, start, nGlyphs, fdArrayCount) {
	var fdSelect = [];
	var fdIndex;
	var parser = new parse.Parser(data, start);
	var format = parser.parseCard8();
	if (format === 0) for (var iGid = 0; iGid < nGlyphs; iGid++) {
		fdIndex = parser.parseCard8();
		if (fdIndex >= fdArrayCount) throw new Error("CFF table CID Font FDSelect has bad FD index value " + fdIndex + " (FD count " + fdArrayCount + ")");
		fdSelect.push(fdIndex);
	}
	else if (format === 3) {
		var nRanges = parser.parseCard16();
		var first = parser.parseCard16();
		if (first !== 0) throw new Error("CFF Table CID Font FDSelect format 3 range has bad initial GID " + first);
		var next;
		for (var iRange = 0; iRange < nRanges; iRange++) {
			fdIndex = parser.parseCard8();
			next = parser.parseCard16();
			if (fdIndex >= fdArrayCount) throw new Error("CFF table CID Font FDSelect has bad FD index value " + fdIndex + " (FD count " + fdArrayCount + ")");
			if (next > nGlyphs) throw new Error("CFF Table CID Font FDSelect format 3 range has bad GID " + next);
			for (; first < next; first++) fdSelect.push(fdIndex);
			first = next;
		}
		if (next !== nGlyphs) throw new Error("CFF Table CID Font FDSelect format 3 range has bad final GID " + next);
	} else throw new Error("CFF Table CID Font FDSelect table has unsupported format " + format);
	return fdSelect;
}
function parseCFFTable(data, start, font, opt) {
	font.tables.cff = {};
	var topDictIndex = parseCFFIndex(data, parseCFFIndex(data, parseCFFHeader(data, start).endOffset, parse.bytesToString).endOffset);
	var stringIndex = parseCFFIndex(data, topDictIndex.endOffset, parse.bytesToString);
	font.gsubrs = parseCFFIndex(data, stringIndex.endOffset).objects;
	font.gsubrsBias = calcCFFSubroutineBias(font.gsubrs);
	var topDictArray = gatherCFFTopDicts(data, start, topDictIndex.objects, stringIndex.objects);
	if (topDictArray.length !== 1) throw new Error("CFF table has too many fonts in 'FontSet' - count of fonts NameIndex.length = " + topDictArray.length);
	var topDict = topDictArray[0];
	font.tables.cff.topDict = topDict;
	if (topDict._privateDict) {
		font.defaultWidthX = topDict._privateDict.defaultWidthX;
		font.nominalWidthX = topDict._privateDict.nominalWidthX;
	}
	if (topDict.ros[0] !== void 0 && topDict.ros[1] !== void 0) font.isCIDFont = true;
	if (font.isCIDFont) {
		var fdArrayOffset = topDict.fdArray;
		var fdSelectOffset = topDict.fdSelect;
		if (fdArrayOffset === 0 || fdSelectOffset === 0) throw new Error("Font is marked as a CID font, but FDArray and/or FDSelect information is missing");
		fdArrayOffset += start;
		var fdArray = gatherCFFTopDicts(data, start, parseCFFIndex(data, fdArrayOffset).objects, stringIndex.objects);
		topDict._fdArray = fdArray;
		fdSelectOffset += start;
		topDict._fdSelect = parseCFFFDSelect(data, fdSelectOffset, font.numGlyphs, fdArray.length);
	}
	var privateDictOffset = start + topDict.private[1];
	var privateDict = parseCFFPrivateDict(data, privateDictOffset, topDict.private[0], stringIndex.objects);
	font.defaultWidthX = privateDict.defaultWidthX;
	font.nominalWidthX = privateDict.nominalWidthX;
	if (privateDict.subrs !== 0) {
		font.subrs = parseCFFIndex(data, privateDictOffset + privateDict.subrs).objects;
		font.subrsBias = calcCFFSubroutineBias(font.subrs);
	} else {
		font.subrs = [];
		font.subrsBias = 0;
	}
	var charStringsIndex;
	if (opt.lowMemory) {
		charStringsIndex = parseCFFIndexLowMemory(data, start + topDict.charStrings);
		font.nGlyphs = charStringsIndex.offsets.length;
	} else {
		charStringsIndex = parseCFFIndex(data, start + topDict.charStrings);
		font.nGlyphs = charStringsIndex.objects.length;
	}
	var charset = parseCFFCharset(data, start + topDict.charset, font.nGlyphs, stringIndex.objects);
	if (topDict.encoding === 0) font.cffEncoding = new CffEncoding(cffStandardEncoding, charset);
	else if (topDict.encoding === 1) font.cffEncoding = new CffEncoding(cffExpertEncoding, charset);
	else font.cffEncoding = parseCFFEncoding(data, start + topDict.encoding, charset);
	font.encoding = font.encoding || font.cffEncoding;
	font.glyphs = new glyphset.GlyphSet(font);
	if (opt.lowMemory) font._push = function(i) {
		var charString = getCffIndexObject(i, charStringsIndex.offsets, data, start + topDict.charStrings);
		font.glyphs.push(i, glyphset.cffGlyphLoader(font, i, parseCFFCharstring, charString));
	};
	else for (var i = 0; i < font.nGlyphs; i += 1) {
		var charString = charStringsIndex.objects[i];
		font.glyphs.push(i, glyphset.cffGlyphLoader(font, i, parseCFFCharstring, charString));
	}
}
var cff = { parse: parseCFFTable };
function parseFvarAxis(data, start, names) {
	var axis = {};
	var p = new parse.Parser(data, start);
	axis.tag = p.parseTag();
	axis.minValue = p.parseFixed();
	axis.defaultValue = p.parseFixed();
	axis.maxValue = p.parseFixed();
	p.skip("uShort", 1);
	axis.name = names[p.parseUShort()] || {};
	return axis;
}
function parseFvarInstance(data, start, axes, names) {
	var inst = {};
	var p = new parse.Parser(data, start);
	inst.name = names[p.parseUShort()] || {};
	p.skip("uShort", 1);
	inst.coordinates = {};
	for (var i = 0; i < axes.length; ++i) inst.coordinates[axes[i].tag] = p.parseFixed();
	return inst;
}
function parseFvarTable(data, start, names) {
	var p = new parse.Parser(data, start);
	var tableVersion = p.parseULong();
	check.argument(tableVersion === 65536, "Unsupported fvar table version.");
	var offsetToData = p.parseOffset16();
	p.skip("uShort", 1);
	var axisCount = p.parseUShort();
	var axisSize = p.parseUShort();
	var instanceCount = p.parseUShort();
	var instanceSize = p.parseUShort();
	var axes = [];
	for (var i = 0; i < axisCount; i++) axes.push(parseFvarAxis(data, start + offsetToData + i * axisSize, names));
	var instances = [];
	var instanceStart = start + offsetToData + axisCount * axisSize;
	for (var j = 0; j < instanceCount; j++) instances.push(parseFvarInstance(data, instanceStart + j * instanceSize, axes, names));
	return {
		axes,
		instances
	};
}
var fvar = { parse: parseFvarTable };
var attachList = function() {
	return {
		coverage: this.parsePointer(Parser.coverage),
		attachPoints: this.parseList(Parser.pointer(Parser.uShortList))
	};
};
var caretValue = function() {
	var format = this.parseUShort();
	check.argument(format === 1 || format === 2 || format === 3, "Unsupported CaretValue table version.");
	if (format === 1) return { coordinate: this.parseShort() };
	else if (format === 2) return { pointindex: this.parseShort() };
	else if (format === 3) return { coordinate: this.parseShort() };
};
var ligGlyph = function() {
	return this.parseList(Parser.pointer(caretValue));
};
var ligCaretList = function() {
	return {
		coverage: this.parsePointer(Parser.coverage),
		ligGlyphs: this.parseList(Parser.pointer(ligGlyph))
	};
};
var markGlyphSets = function() {
	this.parseUShort();
	return this.parseList(Parser.pointer(Parser.coverage));
};
function parseGDEFTable(data, start) {
	start = start || 0;
	var p = new Parser(data, start);
	var tableVersion = p.parseVersion(1);
	check.argument(tableVersion === 1 || tableVersion === 1.2 || tableVersion === 1.3, "Unsupported GDEF table version.");
	var gdef = {
		version: tableVersion,
		classDef: p.parsePointer(Parser.classDef),
		attachList: p.parsePointer(attachList),
		ligCaretList: p.parsePointer(ligCaretList),
		markAttachClassDef: p.parsePointer(Parser.classDef)
	};
	if (tableVersion >= 1.2) gdef.markGlyphSets = p.parsePointer(markGlyphSets);
	return gdef;
}
var gdef = { parse: parseGDEFTable };
var subtableParsers = new Array(10);
subtableParsers[1] = function parseLookup1() {
	var start = this.offset + this.relativeOffset;
	var posformat = this.parseUShort();
	if (posformat === 1) return {
		posFormat: 1,
		coverage: this.parsePointer(Parser.coverage),
		value: this.parseValueRecord()
	};
	else if (posformat === 2) return {
		posFormat: 2,
		coverage: this.parsePointer(Parser.coverage),
		values: this.parseValueRecordList()
	};
	check.assert(false, "0x" + start.toString(16) + ": GPOS lookup type 1 format must be 1 or 2.");
};
subtableParsers[2] = function parseLookup2() {
	var start = this.offset + this.relativeOffset;
	var posFormat = this.parseUShort();
	check.assert(posFormat === 1 || posFormat === 2, "0x" + start.toString(16) + ": GPOS lookup type 2 format must be 1 or 2.");
	var coverage = this.parsePointer(Parser.coverage);
	var valueFormat1 = this.parseUShort();
	var valueFormat2 = this.parseUShort();
	if (posFormat === 1) return {
		posFormat,
		coverage,
		valueFormat1,
		valueFormat2,
		pairSets: this.parseList(Parser.pointer(Parser.list(function() {
			return {
				secondGlyph: this.parseUShort(),
				value1: this.parseValueRecord(valueFormat1),
				value2: this.parseValueRecord(valueFormat2)
			};
		})))
	};
	else if (posFormat === 2) {
		var classDef1 = this.parsePointer(Parser.classDef);
		var classDef2 = this.parsePointer(Parser.classDef);
		var class1Count = this.parseUShort();
		var class2Count = this.parseUShort();
		return {
			posFormat,
			coverage,
			valueFormat1,
			valueFormat2,
			classDef1,
			classDef2,
			class1Count,
			class2Count,
			classRecords: this.parseList(class1Count, Parser.list(class2Count, function() {
				return {
					value1: this.parseValueRecord(valueFormat1),
					value2: this.parseValueRecord(valueFormat2)
				};
			}))
		};
	}
};
subtableParsers[3] = function parseLookup3() {
	return { error: "GPOS Lookup 3 not supported" };
};
subtableParsers[4] = function parseLookup4() {
	return { error: "GPOS Lookup 4 not supported" };
};
subtableParsers[5] = function parseLookup5() {
	return { error: "GPOS Lookup 5 not supported" };
};
subtableParsers[6] = function parseLookup6() {
	return { error: "GPOS Lookup 6 not supported" };
};
subtableParsers[7] = function parseLookup7() {
	return { error: "GPOS Lookup 7 not supported" };
};
subtableParsers[8] = function parseLookup8() {
	return { error: "GPOS Lookup 8 not supported" };
};
subtableParsers[9] = function parseLookup9() {
	return { error: "GPOS Lookup 9 not supported" };
};
function parseGposTable(data, start) {
	start = start || 0;
	var p = new Parser(data, start);
	var tableVersion = p.parseVersion(1);
	check.argument(tableVersion === 1 || tableVersion === 1.1, "Unsupported GPOS table version " + tableVersion);
	if (tableVersion === 1) return {
		version: tableVersion,
		scripts: p.parseScriptList(),
		features: p.parseFeatureList(),
		lookups: p.parseLookupList(subtableParsers)
	};
	else return {
		version: tableVersion,
		scripts: p.parseScriptList(),
		features: p.parseFeatureList(),
		lookups: p.parseLookupList(subtableParsers),
		variations: p.parseFeatureVariationsList()
	};
}
var gpos = { parse: parseGposTable };
var subtableParsers$1 = new Array(9);
subtableParsers$1[1] = function parseLookup1() {
	var start = this.offset + this.relativeOffset;
	var substFormat = this.parseUShort();
	if (substFormat === 1) return {
		substFormat: 1,
		coverage: this.parsePointer(Parser.coverage),
		deltaGlyphId: this.parseUShort()
	};
	else if (substFormat === 2) return {
		substFormat: 2,
		coverage: this.parsePointer(Parser.coverage),
		substitute: this.parseOffset16List()
	};
	check.assert(false, "0x" + start.toString(16) + ": lookup type 1 format must be 1 or 2.");
};
subtableParsers$1[2] = function parseLookup2() {
	var substFormat = this.parseUShort();
	check.argument(substFormat === 1, "GSUB Multiple Substitution Subtable identifier-format must be 1");
	return {
		substFormat,
		coverage: this.parsePointer(Parser.coverage),
		sequences: this.parseListOfLists()
	};
};
subtableParsers$1[3] = function parseLookup3() {
	var substFormat = this.parseUShort();
	check.argument(substFormat === 1, "GSUB Alternate Substitution Subtable identifier-format must be 1");
	return {
		substFormat,
		coverage: this.parsePointer(Parser.coverage),
		alternateSets: this.parseListOfLists()
	};
};
subtableParsers$1[4] = function parseLookup4() {
	var substFormat = this.parseUShort();
	check.argument(substFormat === 1, "GSUB ligature table identifier-format must be 1");
	return {
		substFormat,
		coverage: this.parsePointer(Parser.coverage),
		ligatureSets: this.parseListOfLists(function() {
			return {
				ligGlyph: this.parseUShort(),
				components: this.parseUShortList(this.parseUShort() - 1)
			};
		})
	};
};
var lookupRecordDesc = {
	sequenceIndex: Parser.uShort,
	lookupListIndex: Parser.uShort
};
subtableParsers$1[5] = function parseLookup5() {
	var start = this.offset + this.relativeOffset;
	var substFormat = this.parseUShort();
	if (substFormat === 1) return {
		substFormat,
		coverage: this.parsePointer(Parser.coverage),
		ruleSets: this.parseListOfLists(function() {
			var glyphCount = this.parseUShort();
			var substCount = this.parseUShort();
			return {
				input: this.parseUShortList(glyphCount - 1),
				lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
			};
		})
	};
	else if (substFormat === 2) return {
		substFormat,
		coverage: this.parsePointer(Parser.coverage),
		classDef: this.parsePointer(Parser.classDef),
		classSets: this.parseListOfLists(function() {
			var glyphCount = this.parseUShort();
			var substCount = this.parseUShort();
			return {
				classes: this.parseUShortList(glyphCount - 1),
				lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
			};
		})
	};
	else if (substFormat === 3) {
		var glyphCount = this.parseUShort();
		var substCount = this.parseUShort();
		return {
			substFormat,
			coverages: this.parseList(glyphCount, Parser.pointer(Parser.coverage)),
			lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
		};
	}
	check.assert(false, "0x" + start.toString(16) + ": lookup type 5 format must be 1, 2 or 3.");
};
subtableParsers$1[6] = function parseLookup6() {
	var start = this.offset + this.relativeOffset;
	var substFormat = this.parseUShort();
	if (substFormat === 1) return {
		substFormat: 1,
		coverage: this.parsePointer(Parser.coverage),
		chainRuleSets: this.parseListOfLists(function() {
			return {
				backtrack: this.parseUShortList(),
				input: this.parseUShortList(this.parseShort() - 1),
				lookahead: this.parseUShortList(),
				lookupRecords: this.parseRecordList(lookupRecordDesc)
			};
		})
	};
	else if (substFormat === 2) return {
		substFormat: 2,
		coverage: this.parsePointer(Parser.coverage),
		backtrackClassDef: this.parsePointer(Parser.classDef),
		inputClassDef: this.parsePointer(Parser.classDef),
		lookaheadClassDef: this.parsePointer(Parser.classDef),
		chainClassSet: this.parseListOfLists(function() {
			return {
				backtrack: this.parseUShortList(),
				input: this.parseUShortList(this.parseShort() - 1),
				lookahead: this.parseUShortList(),
				lookupRecords: this.parseRecordList(lookupRecordDesc)
			};
		})
	};
	else if (substFormat === 3) return {
		substFormat: 3,
		backtrackCoverage: this.parseList(Parser.pointer(Parser.coverage)),
		inputCoverage: this.parseList(Parser.pointer(Parser.coverage)),
		lookaheadCoverage: this.parseList(Parser.pointer(Parser.coverage)),
		lookupRecords: this.parseRecordList(lookupRecordDesc)
	};
	check.assert(false, "0x" + start.toString(16) + ": lookup type 6 format must be 1, 2 or 3.");
};
subtableParsers$1[7] = function parseLookup7() {
	var substFormat = this.parseUShort();
	check.argument(substFormat === 1, "GSUB Extension Substitution subtable identifier-format must be 1");
	var extensionLookupType = this.parseUShort();
	var extensionParser = new Parser(this.data, this.offset + this.parseULong());
	return {
		substFormat: 1,
		lookupType: extensionLookupType,
		extension: subtableParsers$1[extensionLookupType].call(extensionParser)
	};
};
subtableParsers$1[8] = function parseLookup8() {
	var substFormat = this.parseUShort();
	check.argument(substFormat === 1, "GSUB Reverse Chaining Contextual Single Substitution Subtable identifier-format must be 1");
	return {
		substFormat,
		coverage: this.parsePointer(Parser.coverage),
		backtrackCoverage: this.parseList(Parser.pointer(Parser.coverage)),
		lookaheadCoverage: this.parseList(Parser.pointer(Parser.coverage)),
		substitutes: this.parseUShortList()
	};
};
function parseGsubTable(data, start) {
	start = start || 0;
	var p = new Parser(data, start);
	var tableVersion = p.parseVersion(1);
	check.argument(tableVersion === 1 || tableVersion === 1.1, "Unsupported GSUB table version.");
	if (tableVersion === 1) return {
		version: tableVersion,
		scripts: p.parseScriptList(),
		features: p.parseFeatureList(),
		lookups: p.parseLookupList(subtableParsers$1)
	};
	else return {
		version: tableVersion,
		scripts: p.parseScriptList(),
		features: p.parseFeatureList(),
		lookups: p.parseLookupList(subtableParsers$1),
		variations: p.parseFeatureVariationsList()
	};
}
var gsub = { parse: parseGsubTable };
function parseHeadTable(data, start) {
	var head = {};
	var p = new parse.Parser(data, start);
	head.version = p.parseVersion();
	head.fontRevision = Math.round(p.parseFixed() * 1e3) / 1e3;
	head.checkSumAdjustment = p.parseULong();
	head.magicNumber = p.parseULong();
	check.argument(head.magicNumber === 1594834165, "Font header has wrong magic number.");
	head.flags = p.parseUShort();
	head.unitsPerEm = p.parseUShort();
	head.created = p.parseLongDateTime();
	head.modified = p.parseLongDateTime();
	head.xMin = p.parseShort();
	head.yMin = p.parseShort();
	head.xMax = p.parseShort();
	head.yMax = p.parseShort();
	head.macStyle = p.parseUShort();
	head.lowestRecPPEM = p.parseUShort();
	head.fontDirectionHint = p.parseShort();
	head.indexToLocFormat = p.parseShort();
	head.glyphDataFormat = p.parseShort();
	return head;
}
var head = { parse: parseHeadTable };
function parseHheaTable(data, start) {
	var hhea = {};
	var p = new parse.Parser(data, start);
	hhea.version = p.parseVersion();
	hhea.ascender = p.parseShort();
	hhea.descender = p.parseShort();
	hhea.lineGap = p.parseShort();
	hhea.advanceWidthMax = p.parseUShort();
	hhea.minLeftSideBearing = p.parseShort();
	hhea.minRightSideBearing = p.parseShort();
	hhea.xMaxExtent = p.parseShort();
	hhea.caretSlopeRise = p.parseShort();
	hhea.caretSlopeRun = p.parseShort();
	hhea.caretOffset = p.parseShort();
	p.relativeOffset += 8;
	hhea.metricDataFormat = p.parseShort();
	hhea.numberOfHMetrics = p.parseUShort();
	return hhea;
}
var hhea = { parse: parseHheaTable };
function parseHmtxTableAll(data, start, numMetrics, numGlyphs, glyphs) {
	var advanceWidth;
	var leftSideBearing;
	var p = new parse.Parser(data, start);
	for (var i = 0; i < numGlyphs; i += 1) {
		if (i < numMetrics) {
			advanceWidth = p.parseUShort();
			leftSideBearing = p.parseShort();
		}
		var glyph = glyphs.get(i);
		glyph.advanceWidth = advanceWidth;
		glyph.leftSideBearing = leftSideBearing;
	}
}
function parseHmtxTableOnLowMemory(font, data, start, numMetrics, numGlyphs) {
	font._hmtxTableData = {};
	var advanceWidth;
	var leftSideBearing;
	var p = new parse.Parser(data, start);
	for (var i = 0; i < numGlyphs; i += 1) {
		if (i < numMetrics) {
			advanceWidth = p.parseUShort();
			leftSideBearing = p.parseShort();
		}
		font._hmtxTableData[i] = {
			advanceWidth,
			leftSideBearing
		};
	}
}
function parseHmtxTable(font, data, start, numMetrics, numGlyphs, glyphs, opt) {
	if (opt.lowMemory) parseHmtxTableOnLowMemory(font, data, start, numMetrics, numGlyphs);
	else parseHmtxTableAll(data, start, numMetrics, numGlyphs, glyphs);
}
var hmtx = { parse: parseHmtxTable };
function parseWindowsKernTable(p) {
	var pairs = {};
	p.skip("uShort");
	var subtableVersion = p.parseUShort();
	check.argument(subtableVersion === 0, "Unsupported kern sub-table version.");
	p.skip("uShort", 2);
	var nPairs = p.parseUShort();
	p.skip("uShort", 3);
	for (var i = 0; i < nPairs; i += 1) {
		var leftIndex = p.parseUShort();
		var rightIndex = p.parseUShort();
		var value = p.parseShort();
		pairs[leftIndex + "," + rightIndex] = value;
	}
	return pairs;
}
function parseMacKernTable(p) {
	var pairs = {};
	p.skip("uShort");
	if (p.parseULong() > 1) console.warn("Only the first kern subtable is supported.");
	p.skip("uLong");
	var subtableVersion = p.parseUShort() & 255;
	p.skip("uShort");
	if (subtableVersion === 0) {
		var nPairs = p.parseUShort();
		p.skip("uShort", 3);
		for (var i = 0; i < nPairs; i += 1) {
			var leftIndex = p.parseUShort();
			var rightIndex = p.parseUShort();
			var value = p.parseShort();
			pairs[leftIndex + "," + rightIndex] = value;
		}
	}
	return pairs;
}
function parseKernTable(data, start) {
	var p = new parse.Parser(data, start);
	var tableVersion = p.parseUShort();
	if (tableVersion === 0) return parseWindowsKernTable(p);
	else if (tableVersion === 1) return parseMacKernTable(p);
	else throw new Error("Unsupported kern table version (" + tableVersion + ").");
}
var kern = { parse: parseKernTable };
function parseLtagTable(data, start) {
	var p = new parse.Parser(data, start);
	var tableVersion = p.parseULong();
	check.argument(tableVersion === 1, "Unsupported ltag table version.");
	p.skip("uLong", 1);
	var numTags = p.parseULong();
	var tags = [];
	for (var i = 0; i < numTags; i++) {
		var tag = "";
		var offset = start + p.parseUShort();
		var length = p.parseUShort();
		for (var j = offset; j < offset + length; ++j) tag += String.fromCharCode(data.getInt8(j));
		tags.push(tag);
	}
	return tags;
}
var ltag = { parse: parseLtagTable };
function parseLocaTable(data, start, numGlyphs, shortVersion) {
	var p = new parse.Parser(data, start);
	var parseFn = shortVersion ? p.parseUShort : p.parseULong;
	var glyphOffsets = [];
	for (var i = 0; i < numGlyphs + 1; i += 1) {
		var glyphOffset = parseFn.call(p);
		if (shortVersion) glyphOffset *= 2;
		glyphOffsets.push(glyphOffset);
	}
	return glyphOffsets;
}
var loca = { parse: parseLocaTable };
function parseMaxpTable(data, start) {
	var maxp = {};
	var p = new parse.Parser(data, start);
	maxp.version = p.parseVersion();
	maxp.numGlyphs = p.parseUShort();
	if (maxp.version === 1) {
		maxp.maxPoints = p.parseUShort();
		maxp.maxContours = p.parseUShort();
		maxp.maxCompositePoints = p.parseUShort();
		maxp.maxCompositeContours = p.parseUShort();
		maxp.maxZones = p.parseUShort();
		maxp.maxTwilightPoints = p.parseUShort();
		maxp.maxStorage = p.parseUShort();
		maxp.maxFunctionDefs = p.parseUShort();
		maxp.maxInstructionDefs = p.parseUShort();
		maxp.maxStackElements = p.parseUShort();
		maxp.maxSizeOfInstructions = p.parseUShort();
		maxp.maxComponentElements = p.parseUShort();
		maxp.maxComponentDepth = p.parseUShort();
	}
	return maxp;
}
var maxp = { parse: parseMaxpTable };
function parseOS2Table(data, start) {
	var os2 = {};
	var p = new parse.Parser(data, start);
	os2.version = p.parseUShort();
	os2.xAvgCharWidth = p.parseShort();
	os2.usWeightClass = p.parseUShort();
	os2.usWidthClass = p.parseUShort();
	os2.fsType = p.parseUShort();
	os2.ySubscriptXSize = p.parseShort();
	os2.ySubscriptYSize = p.parseShort();
	os2.ySubscriptXOffset = p.parseShort();
	os2.ySubscriptYOffset = p.parseShort();
	os2.ySuperscriptXSize = p.parseShort();
	os2.ySuperscriptYSize = p.parseShort();
	os2.ySuperscriptXOffset = p.parseShort();
	os2.ySuperscriptYOffset = p.parseShort();
	os2.yStrikeoutSize = p.parseShort();
	os2.yStrikeoutPosition = p.parseShort();
	os2.sFamilyClass = p.parseShort();
	os2.panose = [];
	for (var i = 0; i < 10; i++) os2.panose[i] = p.parseByte();
	os2.ulUnicodeRange1 = p.parseULong();
	os2.ulUnicodeRange2 = p.parseULong();
	os2.ulUnicodeRange3 = p.parseULong();
	os2.ulUnicodeRange4 = p.parseULong();
	os2.achVendID = String.fromCharCode(p.parseByte(), p.parseByte(), p.parseByte(), p.parseByte());
	os2.fsSelection = p.parseUShort();
	os2.usFirstCharIndex = p.parseUShort();
	os2.usLastCharIndex = p.parseUShort();
	os2.sTypoAscender = p.parseShort();
	os2.sTypoDescender = p.parseShort();
	os2.sTypoLineGap = p.parseShort();
	os2.usWinAscent = p.parseUShort();
	os2.usWinDescent = p.parseUShort();
	if (os2.version >= 1) {
		os2.ulCodePageRange1 = p.parseULong();
		os2.ulCodePageRange2 = p.parseULong();
	}
	if (os2.version >= 2) {
		os2.sxHeight = p.parseShort();
		os2.sCapHeight = p.parseShort();
		os2.usDefaultChar = p.parseUShort();
		os2.usBreakChar = p.parseUShort();
		os2.usMaxContent = p.parseUShort();
	}
	return os2;
}
var os2 = { parse: parseOS2Table };
function parsePostTable(data, start) {
	var post = {};
	var p = new parse.Parser(data, start);
	post.version = p.parseVersion();
	post.italicAngle = p.parseFixed();
	post.underlinePosition = p.parseShort();
	post.underlineThickness = p.parseShort();
	post.isFixedPitch = p.parseULong();
	post.minMemType42 = p.parseULong();
	post.maxMemType42 = p.parseULong();
	post.minMemType1 = p.parseULong();
	post.maxMemType1 = p.parseULong();
	post.names = [];
	switch (post.version) {
		case 1: break;
		case 2:
			post.numberOfGlyphs = p.parseUShort();
			post.glyphNameIndex = new Array(post.numberOfGlyphs);
			for (var i = 0; i < post.numberOfGlyphs; i++) post.glyphNameIndex[i] = p.parseUShort();
			break;
		case 2.5:
			post.numberOfGlyphs = p.parseUShort();
			post.offset = new Array(post.numberOfGlyphs);
			for (var i$1 = 0; i$1 < post.numberOfGlyphs; i$1++) post.offset[i$1] = p.parseChar();
	}
	return post;
}
var post = { parse: parsePostTable };
/**
* @exports opentype.decode
* @class
*/
var decode = {};
/**
* @param {DataView} data
* @param {number} offset
* @param {number} numBytes
* @returns {string}
*/
decode.UTF8 = function(data, offset, numBytes) {
	var codePoints = [];
	var numChars = numBytes;
	for (var j = 0; j < numChars; j++, offset += 1) codePoints[j] = data.getUint8(offset);
	return String.fromCharCode.apply(null, codePoints);
};
/**
* @param {DataView} data
* @param {number} offset
* @param {number} numBytes
* @returns {string}
*/
decode.UTF16 = function(data, offset, numBytes) {
	var codePoints = [];
	var numChars = numBytes / 2;
	for (var j = 0; j < numChars; j++, offset += 2) codePoints[j] = data.getUint16(offset);
	return String.fromCharCode.apply(null, codePoints);
};
/**
* @private
*/
var eightBitMacEncodings = {
	"x-mac-croatian": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø¿¡¬√ƒ≈Ć«Č…\xA0ÀÃÕŒœĐ—“”‘’÷◊©⁄€‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ",
	"x-mac-cyrillic": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»…\xA0ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю",
	"x-mac-gaelic": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØḂ±≤≥ḃĊċḊḋḞḟĠġṀæøṁṖṗɼƒſṠ«»…\xA0ÀÃÕŒœ–—“”‘’ṡẛÿŸṪ€‹›Ŷŷṫ·Ỳỳ⁊ÂÊÁËÈÍÎÏÌÓÔ♣ÒÚÛÙıÝýŴŵẄẅẀẁẂẃ",
	"x-mac-greek": "Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦€ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩάΝ¬ΟΡ≈Τ«»…\xA0ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ­",
	"x-mac-icelandic": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ",
	"x-mac-inuit": "ᐃᐄᐅᐆᐊᐋᐱᐲᐳᐴᐸᐹᑉᑎᑏᑐᑑᑕᑖᑦᑭᑮᑯᑰᑲᑳᒃᒋᒌᒍᒎᒐᒑ°ᒡᒥᒦ•¶ᒧ®©™ᒨᒪᒫᒻᓂᓃᓄᓅᓇᓈᓐᓯᓰᓱᓲᓴᓵᔅᓕᓖᓗᓘᓚᓛᓪᔨᔩᔪᔫᔭ…\xA0ᔮᔾᕕᕖᕗ–—“”‘’ᕘᕙᕚᕝᕆᕇᕈᕉᕋᕌᕐᕿᖀᖁᖂᖃᖄᖅᖏᖐᖑᖒᖓᖔᖕᙱᙲᙳᙴᙵᙶᖖᖠᖡᖢᖣᖤᖥᖦᕼŁł",
	"x-mac-ce": "ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»…\xA0ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ",
	macintosh: "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ",
	"x-mac-romanian": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂȘ∞±≤≥¥µ∂∑∏π∫ªºΩăș¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›Țț‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ",
	"x-mac-turkish": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙˆ˜¯˘˙˚¸˝˛ˇ"
};
/**
* Decodes an old-style Macintosh string. Returns either a Unicode JavaScript
* string, or 'undefined' if the encoding is unsupported. For example, we do
* not support Chinese, Japanese or Korean because these would need large
* mapping tables.
* @param {DataView} dataView
* @param {number} offset
* @param {number} dataLength
* @param {string} encoding
* @returns {string}
*/
decode.MACSTRING = function(dataView, offset, dataLength, encoding) {
	var table = eightBitMacEncodings[encoding];
	if (table === void 0) return;
	var result = "";
	for (var i = 0; i < dataLength; i++) {
		var c = dataView.getUint8(offset + i);
		if (c <= 127) result += String.fromCharCode(c);
		else result += table[c & 127];
	}
	return result;
};
function parseMetaTable(data, start) {
	var p = new parse.Parser(data, start);
	var tableVersion = p.parseULong();
	check.argument(tableVersion === 1, "Unsupported META table version.");
	p.parseULong();
	p.parseULong();
	var numDataMaps = p.parseULong();
	var tags = {};
	for (var i = 0; i < numDataMaps; i++) {
		var tag = p.parseTag();
		var dataOffset = p.parseULong();
		var dataLength = p.parseULong();
		tags[tag] = decode.UTF8(data, start + dataOffset, dataLength);
	}
	return tags;
}
var meta = { parse: parseMetaTable };
/**
* The opentype library.
* @namespace opentype
*/
/**
* Parses OpenType table entries.
* @param  {DataView}
* @param  {Number}
* @return {Object[]}
*/
function parseOpenTypeTableEntries(data, numTables) {
	var tableEntries = [];
	var p = 12;
	for (var i = 0; i < numTables; i += 1) {
		var tag = parse.getTag(data, p);
		var checksum = parse.getULong(data, p + 4);
		var offset = parse.getULong(data, p + 8);
		var length = parse.getULong(data, p + 12);
		tableEntries.push({
			tag,
			checksum,
			offset,
			length,
			compression: false
		});
		p += 16;
	}
	return tableEntries;
}
/**
* Parses WOFF table entries.
* @param  {DataView}
* @param  {Number}
* @return {Object[]}
*/
function parseWOFFTableEntries(data, numTables) {
	var tableEntries = [];
	var p = 44;
	for (var i = 0; i < numTables; i += 1) {
		var tag = parse.getTag(data, p);
		var offset = parse.getULong(data, p + 4);
		var compLength = parse.getULong(data, p + 8);
		var origLength = parse.getULong(data, p + 12);
		var compression = void 0;
		if (compLength < origLength) compression = "WOFF";
		else compression = false;
		tableEntries.push({
			tag,
			offset,
			compression,
			compressedLength: compLength,
			length: origLength
		});
		p += 20;
	}
	return tableEntries;
}
/**
* @typedef TableData
* @type Object
* @property {DataView} data - The DataView
* @property {number} offset - The data offset.
*/
/**
* @param  {DataView}
* @param  {Object}
* @return {TableData}
*/
function uncompressTable(data, tableEntry) {
	if (tableEntry.compression === "WOFF") {
		var inBuffer = new Uint8Array(data.buffer, tableEntry.offset + 2, tableEntry.compressedLength - 2);
		var outBuffer = new Uint8Array(tableEntry.length);
		inflateSync(inBuffer, outBuffer);
		if (outBuffer.byteLength !== tableEntry.length) throw new Error("Decompression error: " + tableEntry.tag + " decompressed length doesn't match recorded length");
		return {
			data: new DataView(outBuffer.buffer, 0),
			offset: 0
		};
	} else return {
		data,
		offset: tableEntry.offset
	};
}
/**
* Parse the OpenType file data (as an ArrayBuffer) and return a Font object.
* Throws an error if the font could not be parsed.
* @param  {ArrayBuffer}
* @param  {Object} opt - options for parsing
* @return {opentype.Font}
*/
function parseBuffer(buffer, opt) {
	opt = opt === void 0 || opt === null ? {} : opt;
	var indexToLocFormat;
	var font = new Font({ empty: true });
	var data = new DataView(buffer, 0);
	var numTables;
	var tableEntries = [];
	var signature = parse.getTag(data, 0);
	if (signature === String.fromCharCode(0, 1, 0, 0) || signature === "true" || signature === "typ1") {
		font.outlinesFormat = "truetype";
		numTables = parse.getUShort(data, 4);
		tableEntries = parseOpenTypeTableEntries(data, numTables);
	} else if (signature === "OTTO") {
		font.outlinesFormat = "cff";
		numTables = parse.getUShort(data, 4);
		tableEntries = parseOpenTypeTableEntries(data, numTables);
	} else if (signature === "wOFF") {
		var flavor = parse.getTag(data, 4);
		if (flavor === String.fromCharCode(0, 1, 0, 0)) font.outlinesFormat = "truetype";
		else if (flavor === "OTTO") font.outlinesFormat = "cff";
		else throw new Error("Unsupported OpenType flavor " + signature);
		numTables = parse.getUShort(data, 12);
		tableEntries = parseWOFFTableEntries(data, numTables);
	} else throw new Error("Unsupported OpenType signature " + signature);
	var cffTableEntry;
	var fvarTableEntry;
	var glyfTableEntry;
	var gdefTableEntry;
	var gposTableEntry;
	var gsubTableEntry;
	var hmtxTableEntry;
	var kernTableEntry;
	var locaTableEntry;
	var metaTableEntry;
	var p;
	for (var i = 0; i < numTables; i += 1) {
		var tableEntry = tableEntries[i];
		var table = void 0;
		switch (tableEntry.tag) {
			case "cmap":
				table = uncompressTable(data, tableEntry);
				font.tables.cmap = cmap.parse(table.data, table.offset);
				font.encoding = new CmapEncoding(font.tables.cmap);
				break;
			case "cvt ":
				table = uncompressTable(data, tableEntry);
				p = new parse.Parser(table.data, table.offset);
				font.tables.cvt = p.parseShortList(tableEntry.length / 2);
				break;
			case "fvar":
				fvarTableEntry = tableEntry;
				break;
			case "fpgm":
				table = uncompressTable(data, tableEntry);
				p = new parse.Parser(table.data, table.offset);
				font.tables.fpgm = p.parseByteList(tableEntry.length);
				break;
			case "head":
				table = uncompressTable(data, tableEntry);
				font.tables.head = head.parse(table.data, table.offset);
				font.unitsPerEm = font.tables.head.unitsPerEm;
				indexToLocFormat = font.tables.head.indexToLocFormat;
				break;
			case "hhea":
				table = uncompressTable(data, tableEntry);
				font.tables.hhea = hhea.parse(table.data, table.offset);
				font.ascender = font.tables.hhea.ascender;
				font.descender = font.tables.hhea.descender;
				font.numberOfHMetrics = font.tables.hhea.numberOfHMetrics;
				break;
			case "hmtx":
				hmtxTableEntry = tableEntry;
				break;
			case "ltag":
				table = uncompressTable(data, tableEntry);
				ltagTable = ltag.parse(table.data, table.offset);
				break;
			case "maxp":
				table = uncompressTable(data, tableEntry);
				font.tables.maxp = maxp.parse(table.data, table.offset);
				font.numGlyphs = font.tables.maxp.numGlyphs;
				break;
			case "OS/2":
				table = uncompressTable(data, tableEntry);
				font.tables.os2 = os2.parse(table.data, table.offset);
				break;
			case "post":
				table = uncompressTable(data, tableEntry);
				font.tables.post = post.parse(table.data, table.offset);
				break;
			case "prep":
				table = uncompressTable(data, tableEntry);
				p = new parse.Parser(table.data, table.offset);
				font.tables.prep = p.parseByteList(tableEntry.length);
				break;
			case "glyf":
				glyfTableEntry = tableEntry;
				break;
			case "loca":
				locaTableEntry = tableEntry;
				break;
			case "CFF ":
				cffTableEntry = tableEntry;
				break;
			case "kern":
				kernTableEntry = tableEntry;
				break;
			case "GDEF":
				gdefTableEntry = tableEntry;
				break;
			case "GPOS":
				gposTableEntry = tableEntry;
				break;
			case "GSUB":
				gsubTableEntry = tableEntry;
				break;
			case "meta": metaTableEntry = tableEntry;
		}
	}
	if (glyfTableEntry && locaTableEntry) {
		var shortVersion = indexToLocFormat === 0;
		var locaTable = uncompressTable(data, locaTableEntry);
		var locaOffsets = loca.parse(locaTable.data, locaTable.offset, font.numGlyphs, shortVersion);
		var glyfTable = uncompressTable(data, glyfTableEntry);
		font.glyphs = glyf.parse(glyfTable.data, glyfTable.offset, locaOffsets, font, opt);
	} else if (cffTableEntry) {
		var cffTable = uncompressTable(data, cffTableEntry);
		cff.parse(cffTable.data, cffTable.offset, font, opt);
	} else throw new Error("Font doesn't contain TrueType or CFF outlines.");
	var hmtxTable = uncompressTable(data, hmtxTableEntry);
	hmtx.parse(font, hmtxTable.data, hmtxTable.offset, font.numberOfHMetrics, font.numGlyphs, font.glyphs, opt);
	addGlyphNames(font, opt);
	if (kernTableEntry) {
		var kernTable = uncompressTable(data, kernTableEntry);
		font.kerningPairs = kern.parse(kernTable.data, kernTable.offset);
	} else font.kerningPairs = {};
	if (gdefTableEntry) {
		var gdefTable = uncompressTable(data, gdefTableEntry);
		font.tables.gdef = gdef.parse(gdefTable.data, gdefTable.offset);
	}
	if (gposTableEntry) {
		var gposTable = uncompressTable(data, gposTableEntry);
		font.tables.gpos = gpos.parse(gposTable.data, gposTable.offset);
		font.position.init();
	}
	if (gsubTableEntry) {
		var gsubTable = uncompressTable(data, gsubTableEntry);
		font.tables.gsub = gsub.parse(gsubTable.data, gsubTable.offset);
	}
	if (fvarTableEntry) {
		var fvarTable = uncompressTable(data, fvarTableEntry);
		font.tables.fvar = fvar.parse(fvarTable.data, fvarTable.offset, font.names);
	}
	if (metaTableEntry) {
		var metaTable = uncompressTable(data, metaTableEntry);
		font.tables.meta = meta.parse(metaTable.data, metaTable.offset);
		font.metas = font.tables.meta;
	}
	return font;
}
function load() {}
function loadSync() {}
var opentype = /*#__PURE__*/ Object.freeze({
	__proto__: null,
	Font,
	Glyph,
	Path,
	_parse: parse,
	parse: parseBuffer,
	load,
	loadSync
});
//#endregion
export { opentype };
