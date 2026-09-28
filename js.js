const startingNumbers = Array.from({ length: 19 }, (_, index) => index + 1);
const segmentColors = ["#287c70", "#f16d50", "#485c52", "#d99b3d", "#347d8b", "#cf765d"];
const spinDuration = 5600;

const wheel = document.querySelector(".wheel");
const segments = document.querySelector(".wheel-segments");
const drawButton = document.querySelector("#draw-button");
const resetButton = document.querySelector("#reset-button");
const resultNumber = document.querySelector("#result-number");
const resultMessage = document.querySelector("#result-message");
const resultDialog = document.querySelector("#result-dialog");
const dialogNumber = document.querySelector("#dialog-number");
const confirmDrawButton = document.querySelector("#confirm-draw");
const soundToggle = document.querySelector("#sound-toggle");
const numberList = document.querySelector("#number-list");
const winnerList = document.querySelector("#winner-list");
const remainingCount = document.querySelector("#remaining-count");
const historyCount = document.querySelector("#history-count");
const drawCount = document.querySelector("#draw-count");

let remainingNumbers = [...startingNumbers];
let winners = [];
let rotation = 0;
let isSpinning = false;
let pendingWinner = null;
let spinTimer;
let audioContext;
let spinSoundTimer;
let spinSoundStartedAt = 0;

function getAudioContext() {
	const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
	if (!soundToggle.checked || !AudioContextConstructor) {
		return null;
	}

	audioContext ??= new AudioContextConstructor();
	return audioContext;
}

function playSpinTick(progress) {
	if (!audioContext || audioContext.state !== "running") {
		return;
	}

	const oscillator = audioContext.createOscillator();
	const volume = audioContext.createGain();
	const now = audioContext.currentTime;
	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(1100 - progress * 500, now);
	volume.gain.setValueAtTime(0.0001, now);
	volume.gain.exponentialRampToValueAtTime(0.024, now + 0.004);
	volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
	oscillator.connect(volume);
	volume.connect(audioContext.destination);
	oscillator.start(now);
	oscillator.stop(now + 0.045);
}

function stopSpinSound() {
	clearTimeout(spinSoundTimer);
	spinSoundTimer = undefined;
}

function startSpinSound() {
	stopSpinSound();
	const context = getAudioContext();
	if (!context) {
		return;
	}

	const playNextTick = () => {
		if (!isSpinning || !soundToggle.checked) {
			return;
		}

		const progress = Math.min(1, (performance.now() - spinSoundStartedAt) / spinDuration);
		playSpinTick(progress);
		const nextInterval = 55 + Math.pow(progress, 1.7) * 245;
		spinSoundTimer = window.setTimeout(playNextTick, nextInterval);
	};

	context.resume().then(playNextTick).catch(() => {});
}

function playDrawSound() {
	const context = getAudioContext();
	if (!context || context.state !== "running") {
		return;
	}

	const now = context.currentTime;
	[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
		const oscillator = context.createOscillator();
		const volume = context.createGain();
		const startAt = now + index * 0.11;
		oscillator.type = "sine";
		oscillator.frequency.setValueAtTime(frequency, startAt);
		volume.gain.setValueAtTime(0.0001, startAt);
		volume.gain.exponentialRampToValueAtTime(0.055, startAt + 0.025);
		volume.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.62);
		oscillator.connect(volume);
		volume.connect(context.destination);
		oscillator.start(startAt);
		oscillator.stop(startAt + 0.63);
	});
}

function polarPoint(radius, angle) {
	const radians = (angle * Math.PI) / 180;
	return {
		x: 300 + radius * Math.cos(radians),
		y: 300 + radius * Math.sin(radians),
	};
}

function renderWheel() {
	const count = remainingNumbers.length;
	segments.replaceChildren();

	if (count === 0) {
		return;
	}

	const sliceAngle = 360 / count;
	const radius = 275;

	remainingNumbers.forEach((number, index) => {
		const startAngle = -90 + index * sliceAngle;
		const endAngle = startAngle + sliceAngle;
		const start = polarPoint(radius, startAngle);
		const end = polarPoint(radius, endAngle);
		const largeArc = sliceAngle > 180 ? 1 : 0;

		const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
		const path = count === 1
			? `M 300 25 A ${radius} ${radius} 0 1 1 300 575 A ${radius} ${radius} 0 1 1 300 25 Z`
			: `M 300 300 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
		segment.setAttribute("d", path);
		segment.setAttribute("fill", segmentColors[index % segmentColors.length]);
		segment.setAttribute("class", "wheel-segment");
		segments.append(segment);

		const labelPoint = polarPoint(radius * 0.73, startAngle + sliceAngle / 2);
		const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
		label.setAttribute("x", labelPoint.x.toFixed(2));
		label.setAttribute("y", labelPoint.y.toFixed(2));
		label.setAttribute("class", "wheel-number");
		label.textContent = String(number);
		segments.append(label);
	});

	wheel.setAttribute("aria-label", `號碼轉盤，剩餘 ${count} 個號碼`);
}

function renderLists() {
	numberList.replaceChildren();
	remainingNumbers.forEach((number) => {
		const item = document.createElement("li");
		item.textContent = String(number);
		numberList.append(item);
	});

	winnerList.replaceChildren();
	if (winners.length === 0) {
		const emptyState = document.createElement("li");
		emptyState.className = "empty-history";
		emptyState.textContent = "抽出的號碼會顯示在這裡";
		winnerList.append(emptyState);
	} else {
		winners.forEach((number, index) => {
			const item = document.createElement("li");
			const winner = document.createElement("span");
			const round = document.createElement("span");
			winner.textContent = `號碼 ${number}`;
			round.className = "winner-round";
			round.textContent = `第 ${index + 1} 抽`;
			item.append(winner, round);
			winnerList.append(item);
		});
	}

	remainingCount.textContent = String(remainingNumbers.length);
	historyCount.textContent = String(winners.length);
	drawCount.textContent = String(winners.length);
	drawButton.disabled = isSpinning || pendingWinner !== null || remainingNumbers.length === 0;
	resetButton.disabled = isSpinning || pendingWinner !== null;
}

function finishDraw(winner) {
	clearTimeout(spinTimer);
	stopSpinSound();
	isSpinning = false;
	pendingWinner = winner;
	playDrawSound();
	resultNumber.textContent = String(winner);
	resultMessage.textContent = "確認號碼後，才會從轉盤移除。";
	dialogNumber.textContent = String(winner);
	resultDialog.showModal();
	confirmDrawButton.focus();
}

function confirmDraw() {
	if (pendingWinner === null) {
		return;
	}

	const winner = pendingWinner;
	pendingWinner = null;
	remainingNumbers = remainingNumbers.filter((number) => number !== winner);
	winners.unshift(winner);
	resultMessage.textContent = "此號碼已移除，不會再次抽到。";
	renderWheel();
	renderLists();

	if (remainingNumbers.length === 0) {
		resultMessage.textContent = "1 到 19 號已全部抽出。";
	}
}

function startDraw() {
	if (isSpinning || pendingWinner !== null || remainingNumbers.length === 0) {
		return;
	}

	isSpinning = true;
	renderLists();
	resultMessage.textContent = "號碼即將揭曉……";
	spinSoundStartedAt = performance.now();
	startSpinSound();

	const winnerIndex = Math.floor(Math.random() * remainingNumbers.length);
	const winner = remainingNumbers[winnerIndex];
	const sliceAngle = 360 / remainingNumbers.length;
	const winnerCenterAngle = -90 + (winnerIndex + 0.5) * sliceAngle;
	const targetAngle = ((-90 - winnerCenterAngle) % 360 + 360) % 360;
	const currentAngle = ((rotation % 360) + 360) % 360;
	const alignmentAngle = (targetAngle - currentAngle + 360) % 360;
	const extraTurns = 6 + Math.floor(Math.random() * 3);

	rotation += extraTurns * 360 + alignmentAngle;
	wheel.style.transition = `transform ${spinDuration}ms cubic-bezier(0.12, 0.72, 0.08, 1)`;
	wheel.style.transform = `rotate(${rotation}deg)`;
	spinTimer = window.setTimeout(() => finishDraw(winner), spinDuration + 100);
}

function resetDraw() {
	if (isSpinning || pendingWinner !== null) {
		return;
	}

	clearTimeout(spinTimer);
	remainingNumbers = [...startingNumbers];
	winners = [];
	rotation = 0;
	wheel.style.transition = "none";
	wheel.style.transform = "rotate(0deg)";
	wheel.getBoundingClientRect();
	wheel.style.transition = "";
	resultNumber.textContent = "--";
	resultMessage.textContent = "準備好揭曉了嗎？";
	renderWheel();
	renderLists();
}

drawButton.addEventListener("click", startDraw);
resetButton.addEventListener("click", resetDraw);
confirmDrawButton.addEventListener("click", () => resultDialog.close());
resultDialog.addEventListener("close", confirmDraw);
soundToggle.addEventListener("change", () => {
	if (!soundToggle.checked) {
		stopSpinSound();
	} else if (isSpinning) {
		startSpinSound();
	}
});

renderWheel();
renderLists();
