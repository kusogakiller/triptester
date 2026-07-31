if (window.top !== window.self) {
    window.top.location = window.location.href;
}

const convert = function () {
    const output = document.getElementById("tripkeys").value
        .split(/\r\n|\r|\n/)
        .map(line => ({
            line: line,
            start: line.search("#") + 1,
        }))
        .filter(meta => meta.start)
        .map(meta => meta.line.substr(meta.start))
        .map(key => {
            const trip = Tripcode.convert(key, document.getElementById("appendRawKey").checked);
            return trip ? "◆" + trip : "無効なトリップです。";
        })
        .join("\n");

    document.getElementById("tripcodes").textContent = output || "No output yet.";

    const copyBtn = document.getElementById("copy");
    if (output) {
        copyBtn.style.display = "inline-block";
        copyBtn.onclick = async () => {
            await navigator.clipboard.writeText(output);
        };
    }
};

const resetForm = function () {
    document.getElementById("tripkeys").value = "#password\n";
    document.getElementById("tripcodes").textContent = "No output yet.";
    document.getElementById("copy").style.display = "none";
};

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("convertBtn").addEventListener("click", convert);
    document.getElementById("clearBtn").addEventListener("click", resetForm);
});
