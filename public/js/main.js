document.addEventListener('DOMContentLoaded', async () => {
	const logsContainer = document.getElementById('logs');
	const fetchTokenForm = document.getElementById('fetchTokenForm');
	const readTokensBtn = document.getElementById('readTokensBtn');
	const uploadImageForm = document.getElementById('uploadImageForm');
	const imageDropdown = document.getElementById('imageDropdown');
	const tokenList = document.getElementById('tokenList');

	$("#paintProgress").progress({ percent: 0 });

	const logSocket = new WebSocket(`ws://${window.location.hostname}:3000`);
	logSocket.onmessage = (event) => {
		addLog(event.data);
	};

	const reportSocket = new WebSocket(`ws://${window.location.hostname}:3002`);

	reportSocket.onmessage = (event) => {
		const data = JSON.parse(event.data);
		const paintRate = data.paintRate.toFixed(2);
		const attackRate = data.attackRate.toFixed(2);
		const recieveRate = data.recieveRate.toFixed(2);
		const coloredRate = data.coloredRate.toFixed(2);
		const buffer = data.buffer;
		const queueTotal = data.queueTotal;
		const queuePos = data.queuePos;
		document.getElementById('paintRate').innerText = `绘画速率： ${paintRate} px/s`;
		document.getElementById('coloredRate').innerText = `着色速度： ${coloredRate} px/s`;
		document.getElementById('attackRate').innerText = `压力大小： ${attackRate} px/s`;
		document.getElementById('recieveRate').innerText = `应答速率： ${recieveRate} req/s`;
		document.getElementById('wsBuffer').innerText = `缓冲大小： ${buffer} B`;
		document.getElementById('paintProgressTitle').innerText = `绘画进度 (${queuePos}/${queueTotal})`;
		const paintedRate = queueTotal ? (queuePos / queueTotal * 100.0) : 0;
		$("#paintProgress").progress({ percent: paintedRate });
	};

	// Function to add a log entry
	function addLog(message) {
		const logItem = document.createElement('div');
		logItem.className = 'item';
		logItem.textContent = message;
		logsContainer.appendChild(logItem);
		logsContainer.scrollTop = logsContainer.scrollHeight;
	}

	// Fetch and populate images
	async function fetchImages() {
		try {
			const response = await fetch('/api/images');
			if (response.ok) {
				const images = await response.json();
				imageDropdown.innerHTML = '<option value="" disabled selected>选择图像...</option>';
				images.forEach((image) => {
					const option = document.createElement('option');
					option.value = image;
					option.textContent = image;
					imageDropdown.appendChild(option);
				});
			} else {
				addLog(`图片列表获取失败，状态码：${response.status}。`);
			}
		} catch (error) {
			addLog('图片列表获取失败。');
			console.error(error);
		}
	}

	async function getInfo() {
		return (await fetch('/api/getinfo')).json();
	}

	// Fetch and display tokens
	async function fetchTokens() {
		try {
			const response = await fetch('/api/tokens');
			if (response.ok) {
				const tokens = await response.json();
				tokenList.innerHTML = '';
				tokens.forEach((token) => {
					const item = document.createElement('div');
					item.className = 'item';
					item.textContent = `${token.token}#${token.uid}`;
					tokenList.appendChild(item);
				});
				const tokenCount = document.getElementById('tokenCount');
				tokenCount.innerText = `Tokens (${tokens.length})`;
				$('#slider-token').range({
					min: 1,          // 最小值
					max: tokens.length,        // 最大值
					start: (await getInfo()).fmax,
					step: 1,         // 步长
					onChange: async function (value) {
						const tokenUsed = document.getElementById('tokenUsing');
						tokenUsed.innerText = `Token 投入数量 (${value})`;
						await fetch('/api/setfmax', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ new_fmax: value }),
						});
					}
				});
			} else {
				addLog(`获取 Token 列表失败，状态码：${response.status}。`);
			}
		} catch (error) {
			addLog('获取 Token 列表失败。');
			console.error(error);
		}
	}

	fetchTokenForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const uid = document.getElementById('uid').value;
		const paste = document.getElementById('paste').value;
		document.getElementById('uid').value = ""
		document.getElementById('paste').value = ""
		try {
			const response = await fetch('/api/paintboard/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uid, paste }),
			});
			if (response.ok) {
				const data = await response.json();
				addLog(`已添加 Token：${data.data.token}#${uid}。`);
				fetchTokens();
			} else {
				addLog(`Token 获取失败，状态码：${response.status}。`);
			}
		} catch (error) {
			addLog('Token 获取失败。');
			console.error(error);
		}
	});

	// Upload Image
	uploadImageForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const formData = new FormData(uploadImageForm);
		try {
			const response = await fetch('/api/upload-image', {
				method: 'POST',
				body: formData,
			});
			if (response.ok) {
				const data = await response.json();
				addLog(`图像上传成功，大小：${data.width}x${data.height}。`);
				await fetchImages(); // 更新图片列表
			} else {
				addLog(`图像上传失败，状态码：${response.status}。`);
			}
		} catch (error) {
			addLog('图像上传失败。');
			console.error(error);
		}
	});

	// Initial fetch
	fetchImages();
	fetchTokens();

	readTokensBtn.addEventListener('click', fetchTokens); // 刷新 token 列表
	const startDrawForm = document.getElementById('startDrawForm');

	// Function to start drawing task
	startDrawForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const startX = parseInt(document.getElementById('startX').value);
		const startY = parseInt(document.getElementById('startY').value);
		const imageName = document.getElementById('imageDropdown').value;

		if (startX < 0 || startX > 1000 || startY < 0 || startY > 600 || !imageName) {
			addLog('无效的图像或起始坐标。');
			return;
		}

		// Send request to start drawing
		try {
			const response = await fetch('/api/start-draw', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageName, startX, startY }),
			});
			if (response.ok) {
				const data = await response.json();
				addLog(data.message);
			} else {
				addLog(`绘画任务启动失败，状态码：${response.status}。`);
			}
		} catch (error) {
			addLog('绘画任务启动失败。');
			console.error(error);
		}
	});
	const stopDrawingButton = document.getElementById('stopDrawingButton');

	// 停止绘画任务
	stopDrawingButton.addEventListener('click', async (e) => {
		e.preventDefault();
		try {
			const response = await fetch('/api/stop-draw', {
				method: 'POST',
			});
			if (response.ok) {
				const data = await response.json();
				addLog(data.message);
			} else {
				addLog(`绘画任务停止失败，状态码：${response.status}。`);
			}
		} catch (error) {
			addLog('绘画任务停止失败。');
			console.error(error);
		}
	});

	$('#slider-sim').range({
		min: 0,
		max: 20,
		start: (await getInfo()).sim,
		step: 0.05,
		onChange: async function (value) {
			const simValue = document.getElementById('simValue');
			simValue.innerText = `相似度阈值 (${value})`;
			await fetch('/api/setsimval', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ new_simval: value }),
			});
		}
	});

	$('#slider-mod').range({
		min: 0,
		max: 60000,
		start: (await getInfo()).mod,
		step: 1000,
		onChange: async function (value) {
			const simValue = document.getElementById('modValue');
			simValue.innerText = `绘版 CD (${value})`;
			await fetch('/api/setmod', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ new_mod: value }),
			});
		}
	});
});
