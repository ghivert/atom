"use strict";

describe("Utilities", () => {
	
	describe("General-purpose functions", () => {
		const utils = require("../lib/utils/general.js");
		
		describe("isString()", () => {
			const {isString} = utils;
			it("identifies literals",   () => void expect(isString("foo")).to.be.true);
			it("identifies objects",    () => void expect(isString(new String("foo"))).to.be.true);
			it("identifies subclasses", () => {
				class IndentedString extends String {
					constructor(source){
						super((source + "").replace(/^/g, "\t"));
					}
				}
				const str = new IndentedString("A");
				expect(str).to.match(/^\tA$/);
				expect(isString(str)).to.be.true;
			});
		});
		
		describe("isRegExp()", () => {
			const {isRegExp} = utils;
			it("identifies literals",   () => void expect(isRegExp(/A/)).to.be.true);
			it("identifies objects",    () => void expect(isRegExp(new RegExp("A"))).to.be.true);
			it("identifies subclasses", () => {
				class ExtendedRegExp extends RegExp {
					constructor(source, flags){
						source = source
							.replace(/\[[^\]]+\]/g, s => s
								.replace(/ /, "\\x20")
								.replace(/\t/, "\\t"))
							.replace(/\s+/g, "");
						super(source, flags);
						
						Object.defineProperty(this, "source", {
							get: () => source
						});
					}
				}
				const regexp = new ExtendedRegExp("^ A B C $");
				expect("ABC").to.match(regexp);
				expect(isRegExp(regexp)).to.be.true;
			});
		});
		
		describe("isNumeric()", () => {
			const {isNumeric} = utils;
			it("allows numeric arguments",      () => void expect(isNumeric(0xBABEFACE)).to.be.true);
			it("recognises positive integers",  () => void expect(isNumeric("45")).to.be.true);
			it("recognises negative integers",  () => void expect(isNumeric("-5")).to.be.true);
			it("recognises positive floats",    () => void expect(isNumeric("2.5")).to.be.true);
			it("recognises negative floats",    () => void expect(isNumeric("-2.5")).to.be.true);
			it("recognises basic numbers only", () => {
				expect(isNumeric("0b10100100")).to.be.false;
				expect(isNumeric("0xBABEFACE")).to.be.false;
				expect(isNumeric("3.1536e+10")).to.be.false;
				expect(isNumeric("0xAF")).to.be.false;
			});
		});
		
		describe("escapeRegExp()", () => {
			const {escapeRegExp} = utils;
			it("escapes backslashes",       () => void expect(escapeRegExp("\\")).to.equal("\\\\"));
			it("escapes metacharacters",    () => void expect(escapeRegExp("$")).to.equal("\\$"));
			it("escapes character classes", () => void expect(escapeRegExp("[ABC]")).to.equal("\\[ABC\\]"));
			it("escapes capturing groups",  () => void expect(escapeRegExp("(A)")).to.equal("\\(A\\)"));
			it("escapes source accurately", () => {
				const pattern = /^ember(?:\.|(?:-[^.]+)?-(?:\d+\.)+(?:debug\.)?)js$/i;
				const source = escapeRegExp(pattern.source);
				expect(new RegExp(source).test(pattern.source)).to.be.true;
			});
		});
		
		describe("fuzzyRegExp()", () => {
			const fuzz = utils.fuzzyRegExp;
			it("returns case-insensitive patterns",          () => void expect("abc")    .to.match(fuzz("aBc")));
			it('fuzzes the letter "O" to match zeroes',      () => void expect("f0o")    .to.match(fuzz("foo")));
			it("fuzzes word boundaries to match hyphens",    () => void expect("abc-xyz").to.match(fuzz("abc xyz")));
			it("fuzzes word boundaries to match whitespace", () => void expect("abc xyz").to.match(fuzz("abc-xyz")));
			it("treats camelCase/PascalCase as boundaries",  () => void expect("abc xyz").to.match(fuzz("abcXyz")));
			it("treats stylised caps as word boundaries",    () => void expect("d-base") .to.match(fuzz("dBASE")));
			it("makes boundary separators optional",         () => void expect("abcxyz") .to.match(fuzz("ABC-XYZ")));
			it("makes punctuation optional",                 () => void expect("abc")    .to.match(fuzz("A.B.C.")));
		});
		
		describe("caseKludge", () => {
			const {caseKludge} = utils;
			it("generates case-insensitive regex source", () => {
				const pattern = new RegExp(`^(ABC|${caseKludge("DEF")})`);
				expect("dEf").to.match(pattern);
				expect("aBc").not.to.match(pattern);
			});
			
			it("fuzzes word boundaries", () => {
				const source = caseKludge("camelCase", true);
				const pattern = new RegExp(`^abc: ${source}$`);
				expect("abc: camelCASE").to.match(pattern);
				expect("abc: camel-CASE").to.match(pattern);
				expect("ABC: camel-CASE").not.to.match(pattern);
			});
			
			it("allows multiple separators between fuzzed boundaries", () => {
				const source = caseKludge("camelCase", true);
				const pattern = new RegExp(`^abc: ${source}$`);
				expect("abc: camel----CASE").to.match(pattern);
				expect("abc: camel--CA").not.to.match(pattern);
			});
		});
		
		describe("punch()", () => {
			const {punch} = utils;
			
			class Example {
				constructor(name){ this.name = name; }
				count(a, b, c){ return a + b + c; }
				getName(){ return this.name; }
			}
			
			it("replaces methods", () => {
				const obj = new Example("A");
				expect(obj.getName()).to.equal("A");
				punch(obj, "getName", () => "B");
				expect(obj.getName()).to.equal("B");
			});
			
			it("allows handlers to call the original method", () => {
				const obj = new Example("A");
				punch(obj, "count", fn => fn() + fn());
				expect(obj.count(1, 2, 3)).to.equal(12);
			});
			
			it("gives handlers access to the original arguments", () => {
				const obj = new Example("A");
				punch(obj, "count", (fn, args) => +([...args].join("")) + fn());
				expect(obj.count(1, 2, 3)).to.equal(129);
			});
			
			it("returns the original method in an array", () => {
				const obj = new Example("A");
				const oldMethod = obj.getName;
				const methods = punch(obj, "getName", () => {});
				expect(methods).to.be.an("array");
				expect(methods).to.have.lengthOf(2);
				expect(methods[0]).to.equal(oldMethod);
			});
		});
	});


	describe("Filesystem functions", () => {
		const utils = require("../lib/utils/fs.js");
		const fs = require("fs");
		
		describe("statify()", () => {
			const {statify} = utils;
			const plainStats = {
				dev: 16777220,
				mode: 33188,
				nlink: 1,
				uid: 501,
				gid: 20,
				rdev: 0,
				blksize: 4096,
				ino: 175025642,
				size: 1104,
				blocks: 8,
				atime: 1481195566000,
				mtime: 1481195249000,
				ctime: 1481195249000,
				birthtime: 1481192516000
			};
			
			it("converts plain objects into fs.Stats instances", () => {
				const obj = statify(plainStats);
				expect(obj.constructor).to.equal(fs.Stats);
			});
			
			it("leaves actual fs.Stats instances untouched", () => {
				const realStats = Object.freeze(fs.lstatSync(__filename));
				const statified = statify(realStats);
				expect(realStats).to.equal(statified);
			});
			
			it("retains accurate timestamps", () => {
				const obj = statify(plainStats);
				expect(obj.atime).to.be.a("date");
				expect(obj.mtime).to.be.a("date");
				expect(obj.ctime).to.be.a("date");
				expect(obj.birthtime).to.be.a("date");
				expect(obj.atime.getTime()).to.equal(1481195566000);
				expect(obj.mtime.getTime()).to.equal(1481195249000);
				expect(obj.ctime.getTime()).to.equal(1481195249000);
				expect(obj.ctime.getTime()).not.to.equal(1481195249001);
				expect(obj.birthtime.getTime()).to.equal(1481192516000);
			});
			
			it("retains accurate mode-checking methods", () => {
				const modeChecks = {
					isBlockDevice:     0b0110000110100000,
					isCharacterDevice: 0b0010000110110110,
					isDirectory:       0b0100000111101101,
					isFIFO:            0b0001000110100100,
					isFile:            0b1000000111101101,
					isSocket:          0b1100000111101101,
					isSymbolicLink:    0b1010000111101101
				};
				
				for(const methodName in modeChecks){
					const mode = modeChecks[methodName];
					const stat = statify(Object.assign({}, plainStats, {mode}));
					expect(stat.mode, methodName).to.equal(mode);
					expect(stat[methodName], methodName).to.be.a("function");
					expect(stat[methodName](), `${methodName}(${mode})`).to.be.true;
				}
			});
		});
		
		describe("sampleFile()", () => {
			const {sampleFile} = utils;
			const path = require("path");
			
			it("reads partial data from the filesystem", () => {
				const [dataSample] = sampleFile(__filename, 10);
				expect(dataSample).to.equal('"use stric');
			});
			
			it("indicates if a file was fully-loaded", () => {
				const results = sampleFile(__filename, 1);
				expect(results).to.be.an("array");
				expect(results).to.have.lengthOf(2);
				expect(results[1]).to.be.false;
			});
			
			it("allows reading from an arbitrary offset", () => {
				const [dataSample] = sampleFile(__filename, 10, 1);
				expect(dataSample).to.equal("use strict");
			});
			
			it("trims extra bytes if content is shorter than sample limit", () => {
				const imagePath = path.resolve(__dirname, "fixtures/basic/image.gif");
				const [dataSample] = sampleFile(imagePath, 100);
				expect(dataSample).to.have.lengthOf(42);
			});
		});
	});


	describe("MappedDisposable class", () => {
		const MappedDisposable = require("../lib/utils/mapped-disposable.js");
		const {CompositeDisposable, Disposable} = require("atom");
		
		it("can be constructed with an iterable", () => {
			const disposable1 = new Disposable();
			const disposable2 = new Disposable();
			const disposable3 = new CompositeDisposable();
			const map = new MappedDisposable([
				[{name: "foo"}, disposable1],
				[{name: "bar"}, disposable2],
				[{name: "baz"}, disposable3]
			]);
			map.dispose();
			expect(disposable1.disposed).to.be.true;
			expect(disposable2.disposed).to.be.true;
			expect(disposable3.disposed).to.be.true;
		});
		
		it("can be constructed without an iterable", () => {
			const map = new MappedDisposable();
			expect(map.disposed).to.be.false;
			map.dispose();
			expect(map.disposed).to.be.true;
		});
		
		it("embeds ordinary disposables in CompositeDisposables", () => {
			const disposable1 = new Disposable();
			const disposable2 = new CompositeDisposable();
			const map = new MappedDisposable([
				["foo", disposable1],
				["bar", disposable2]
			]);
			expect(map.get("foo")).to.be.instanceof(CompositeDisposable);
			expect(map.get("bar")).to.equal(disposable2);
		});
		
		it("allows disposables to be added to keys", () => {
			const key = {};
			const cd1 = new CompositeDisposable();
			const cd2 = new CompositeDisposable();
			const cd3 = new CompositeDisposable();
			const map = new MappedDisposable([ [key, cd1] ]);
			expect(map.get(key)).to.equal(cd1);
			map.add(key, cd2);
			expect(cd1.disposables.size).to.equal(1);
			map.add("foo", cd3);
			expect(map.size).to.equal(2);
			map.dispose();
			expect(map.disposed).to.be.true;
			expect(cd1.disposed).to.be.true;
			expect(cd2.disposed).to.be.true;
		});
		
		it("allows disposables to be removed from keys", () => {
			const key = {};
			const cd1 = new CompositeDisposable();
			const cd2 = new CompositeDisposable();
			const cd3 = new CompositeDisposable();
			const cd4 = new CompositeDisposable();
			const cd5 = new CompositeDisposable();
			const map = new MappedDisposable([ [key, cd1] ]);
			map.add(key, cd2, cd3, cd4, cd5);
			expect(cd1.disposables.size).to.equal(4);
			map.remove(key, cd3, cd5);
			expect(cd1.disposables.size).to.equal(2);
			map.dispose();
			expect(map.disposed).to.be.true;
			expect(cd1.disposed).to.be.true;
			expect(cd2.disposed).to.be.true;
			expect(cd3.disposed).to.be.false;
			expect(cd4.disposed).to.be.true;
			expect(cd5.disposed).to.be.false;
		});
		
		it("allows other MappedDisposables to be added to keys", () => {
			const disposable = new Disposable();
			const map1 = new MappedDisposable([ ["foo", disposable] ]);
			const map2 = new MappedDisposable([ ["bar", map1] ]);
			expect(map1.get("foo").disposables.has(disposable)).to.be.true;
			expect(map2.get("bar").disposables.has(map1)).to.be.true;
			map2.dispose();
			expect(disposable.disposed).to.be.true;
			expect(map1.disposed).to.be.true;
			expect(map2.disposed).to.be.true;
		});
		
		it("reports accurate entry count", () => {
			const map = new MappedDisposable();
			expect(map.size).to.equal(0);
			map.add("foo", new Disposable());
			expect(map.size).to.equal(1);
			map.add("foo", new Disposable());
			map.add("bar", new Disposable());
			expect(map.size).to.equal(2);
			map.delete("foo");
			expect(map.size).to.equal(1);
			map.dispose();
			expect(map.size).to.equal(0);
		});
		
		it("deletes keys when disposing them", () => {
			const key = {};
			const cd1 = new CompositeDisposable();
			const map = new MappedDisposable([ [key, cd1] ]);
			map.delete(key);
			expect(map.has(key)).to.be.false;
			expect(map.get(key)).to.be.undefined;
			map.dispose();
			expect(cd1.disposed).to.be.false;
		});
		
		it("deletes all keys when disposed", () => {
			const map = new MappedDisposable([
				["foo", new Disposable()],
				["bar", new Disposable()]
			]);
			expect(map.has("foo")).to.be.true;
			expect(map.has("bar")).to.be.true;
			map.dispose();
			expect(map.has("foo")).to.be.false;
			expect(map.has("bar")).to.be.false;
			expect(map.size).to.equal(0);
		});
		
		it("allows a disposable list to be replaced with another", () => {
			const cd1 = new CompositeDisposable();
			const cd2 = new CompositeDisposable();
			const key = {};
			const map = new MappedDisposable([[key, cd1]]);
			map.set(key, cd2);
			expect(map.get(key)).to.equal(cd2);
			expect(map.get(key).disposables.has(cd1)).to.be.false;
			map.dispose();
			expect(cd1.disposed).to.be.false;
			expect(cd2.disposed).to.be.true;
		});
		
		it("throws an error when setting a value to a non-disposable", () => {
			expect(() => {
				const key = {};
				const map = new MappedDisposable([ [key, new Disposable()] ]);
				map.set(key, {});
			}).to.throw("Value must have a .dispose() method");
		});
	});
});
