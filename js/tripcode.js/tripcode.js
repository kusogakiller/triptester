/*
2017/11/06 prototypeメソッドの定義を修正
2017/11/06 SHA-1ダイジェストの記号置換を修正
2017/11/02 FreeBSD 0x80バグ再現を削除
2017/07/31 変換処理を整理
2017/07/29 インデント調整(タブ文字→半角スペース)
2017/07/28 クロージャ周りを整理
2017/07/11 ES2015
2016/08/18 無駄な処理を削減
2016/02/20 Unicode文字および絵文字に対応
2014/05/05 公開

以下のライブラリを使用しています。
ecl.js  : http://www.junoe.jp/downloads/itoh/enc_js.shtml
des.js  : http://user1.matsumoto.ne.jp/~goma/js/des.html
sha1.js : http://user1.matsumoto.ne.jp/~goma/js/hash.html
*/

(() => {
    if (window.Tripcode) return;

    /** Shift_JISエスケープされた中黒 */
    const interpunct = EscapeSJIS("・");

    /** Shift_JISに変換できないUnicodeを文字参照に変換 */
    const toShiftJIS = char => char.length > 1 || char !== "・" && EscapeSJIS(char) === interpunct ? `&#${char.codePointAt(0)};` : char;

    /** Shift_JISエスケープされた文字のパターン */
    const shiftJISPercentEncodingPattern = /%([A-Z0-9]{2})/g;

    /** ダイジェストをバイナリ文字に変換 */
    const toBinary = (substring, arg1) => String.fromCodePoint(parseInt(arg1, 16));

    /** 10桁トリップ生キーのパターン */
    const rawKeyPattern = /^#([0-9A-Fa-f]{16})([.\/0-9A-Za-z]{0,2})$/;

    /** 末尾ピリオドのパターン */
    const tailPeriodsPattern = /\.+$/;

    /** ダイジェストを生キーに変換 */
    const rawKey = (digest, salt) => "##" + digest.toUpperCase() + salt.replace(tailPeriodsPattern, "");

    /** プラス全てにマッチするパターン */
    const allPlusesPattern = /\+/g;

    /** バイナリ文字をsaltに変換 (online 10桁仕様) */
    const toSalt = char => {
        const codePoint = char.codePointAt(0);
        if (0x21 <= codePoint && codePoint <= 0x2D) {
            return String.fromCodePoint(codePoint + 0x4D);
        }
        if (0x3A <= codePoint && codePoint <= 0x40) {
            return String.fromCodePoint(codePoint + 0x07);
        }
        if (0x5B <= codePoint && codePoint <= 0x60) {
            return String.fromCodePoint(codePoint + 0x06);
        }
        if (0x2E <= codePoint && codePoint <= 0x7A) {
            return char;
        }
        return ".";
    };

    /** 10桁トリップ変換 */
    const crypt = (key, salt) => des.crypt(key.split("\x00")[0], salt).substr(-10);

    /**
     * 10桁トリップ生成
     */
    const tripcodeWithKey = (key, appendRawKey) => {
        // saltを準備
        let salt = "H.";
        if (key.length > 0) {
            salt = [...`${key}${salt}`.substr(1, 2)].map(toSalt).join("");
        }

        // DESに使うキーを準備 (NULで打ち切り)
        const desKey = key.split("\x00")[0];

        // 変換
        const tripcode = crypt(desKey, salt);

        // 生キー付加
        if (appendRawKey) {
            const digest = [...desKey]
                .map(char => char.codePointAt(0).toString(16).padStart(2, "0"))
                .join("")
                .padEnd(16, "0")
                .substr(0, 16);
            return tripcode + " " + rawKey(digest, salt);
        }

        return tripcode;
    };

    /**
     * 10桁トリップ生成(生キー)
     */
    const tripcodeWithRawKey = (key, append) => {
        if (key[0] !== "#") return null;

        const result = key.match(rawKeyPattern);
        if (!result) return null;

        const digest = result[1];
        const salt = (result[2] + "..").substr(0, 2);

        // キーをバイナリ文字列に変換
        key = new Array(8)
            .fill()
            .map((v, i) => "%" + digest.substr(i * 2, 2))
            .join("");
        key = unescape(key);

        // 変換
        const tripcode = crypt(key, salt);

        // 生キー付加
        return append
            ? tripcode + " " + rawKey(digest, salt)
            : tripcode;
    };

    /**
     * 12桁トリップ生成
     */
    const tripcode12WithKey = (key) => {
        return btoa(sha1.bin(key))
            .substr(0, 12)
            .replace(allPlusesPattern, ".");
    };

    /** Unicode文字を10進数の数値文字参照に変換 */
    const toShiftJISString = key => [...key].map(toShiftJIS).join("");

    /**
     * 文字列をトリップに変換 (online仕様)
     */
    const tripcode = (key, appendRawKey) => {
        appendRawKey = !!appendRawKey;

        // 改行コードがあれば除去
        key = key.replace(/\r|\n/g, "");

        // 孤立したサロゲートをU+FFFDに置換
        key = key.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "\uFFFD").replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1\uFFFD");

        // HTML特殊文字をエスケープ (< > & ")
        key = key.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        // "#$"で始まるキーは無効
        if (key.startsWith("#$")) return null;

        // UTF-8でのバイト長を測定
        const utf8len = [...key].reduce((len, c) => {
            const cp = c.codePointAt(0);
            return len + (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);
        }, 0);

        // 10桁/生キー相当: キーがUTF-8で1byte以上10byte以下
        if (utf8len >= 1 && utf8len <= 10) {
            const utf8bytes = unescape(encodeURIComponent(key));
            return tripcodeWithKey(utf8bytes, appendRawKey);
        }

        // 12桁/生キー: キーがUTF-8で12byte以上、かつ32文字以下
        if (utf8len >= 12 && [...key].length <= 32) {
            key = toShiftJISString(key);
            key = EscapeSJIS(key).replace(shiftJISPercentEncodingPattern, toBinary);
            return tripcodeWithRawKey(key, appendRawKey)
                || tripcode12WithKey(key);
        }

        return null;
    };

    window.Tripcode = {
        shiftJIS: toShiftJISString,
        convert: tripcode,
    };
})();
