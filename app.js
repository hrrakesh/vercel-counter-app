let count = 0;

const counter = document.getElementById("counter");

document.getElementById("increase").onclick = () => {
    count++;
    counter.textContent = count;
};

document.getElementById("decrease").onclick = () => {
    count--;
    counter.textContent = count;
};

document.getElementById("reset").onclick = () => {
    count = 0;
    counter.textContent = count;
};