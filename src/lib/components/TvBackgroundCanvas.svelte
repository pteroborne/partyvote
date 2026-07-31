<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let { enabled = true, speedMultiplier = 1.0 } = $props<{
		enabled?: boolean;
		speedMultiplier?: number;
	}>();

	let canvas: HTMLCanvasElement | null = $state(null);
	let animId: number | null = null;

	interface Star {
		x: number;
		y: number;
		z: number;
		size: number;
		brightness: number;
		color: string;
	}

	interface Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		alpha: number;
		pulse: number;
		color: string;
	}

	let stars: Star[] = [];
	let particles: Particle[] = [];
	let gridOffset = 0;
	let nebulaPulse = 0;

	onMount(() => {
		if (canvas) {
			initScene();
			window.addEventListener('resize', resizeCanvas);
			animId = requestAnimationFrame(renderFrame);
		}
	});

	onDestroy(() => {
		if (animId) cancelAnimationFrame(animId);
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', resizeCanvas);
		}
	});

	function resizeCanvas() {
		if (!canvas) return;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = window.innerWidth * dpr;
		canvas.height = window.innerHeight * dpr;
	}

	function initScene() {
		resizeCanvas();
		if (!canvas) return;

		const numStars = 200;
		stars = [];
		const colors = ['#ffffff', '#00f0ff', '#ff1e42', '#ffd700', '#b55fe6'];

		for (let i = 0; i < numStars; i++) {
			stars.push({
				x: (Math.random() - 0.5) * canvas.width * 2.2,
				y: (Math.random() - 0.5) * canvas.height * 2.2,
				z: Math.random() * canvas.width,
				size: Math.random() * 1.8 + 0.6,
				brightness: Math.random() * 0.8 + 0.2,
				color: colors[Math.floor(Math.random() * colors.length)]
			});
		}

		const numParticles = 55;
		particles = [];
		for (let i = 0; i < numParticles; i++) {
			particles.push({
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height,
				vx: (Math.random() - 0.5) * 0.6,
				vy: -Math.random() * 1.0 - 0.4,
				size: Math.random() * 3 + 1,
				alpha: Math.random() * 0.7 + 0.2,
				pulse: Math.random() * Math.PI * 2,
				color: colors[Math.floor(Math.random() * colors.length)]
			});
		}
	}

	function renderFrame() {
		if (!canvas || !enabled) {
			if (enabled) animId = requestAnimationFrame(renderFrame);
			return;
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const width = canvas.width;
		const height = canvas.height;
		const speed = speedMultiplier;
		nebulaPulse += 0.005 * speed;

		// Deep space backdrop
		ctx.fillStyle = '#04040a';
		ctx.fillRect(0, 0, width, height);

		// Render Cosmic Nebulae Gas Clouds
		const neb1X = width * 0.2 + Math.sin(nebulaPulse) * 80;
		const neb1Y = height * 0.3 + Math.cos(nebulaPulse * 0.8) * 50;
		const grad1 = ctx.createRadialGradient(neb1X, neb1Y, 10, neb1X, neb1Y, width * 0.45);
		grad1.addColorStop(0, 'rgba(0, 240, 255, 0.07)');
		grad1.addColorStop(0.5, 'rgba(181, 95, 230, 0.04)');
		grad1.addColorStop(1, 'transparent');
		ctx.fillStyle = grad1;
		ctx.fillRect(0, 0, width, height);

		const neb2X = width * 0.8 - Math.cos(nebulaPulse * 0.7) * 90;
		const neb2Y = height * 0.7 + Math.sin(nebulaPulse * 0.9) * 60;
		const grad2 = ctx.createRadialGradient(neb2X, neb2Y, 10, neb2X, neb2Y, width * 0.5);
		grad2.addColorStop(0, 'rgba(255, 30, 66, 0.06)');
		grad2.addColorStop(0.5, 'rgba(255, 215, 0, 0.03)');
		grad2.addColorStop(1, 'transparent');
		ctx.fillStyle = grad2;
		ctx.fillRect(0, 0, width, height);

		// Moving Perspective Grid
		gridOffset = (gridOffset + 0.6 * speed) % 60;
		ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
		ctx.lineWidth = 1;

		const horizonY = height * 0.36;

		// Horizontal grid lines
		for (let y = horizonY; y < height; y += 60) {
			const py = y + gridOffset;
			if (py < height) {
				ctx.beginPath();
				ctx.moveTo(0, py);
				ctx.lineTo(width, py);
				ctx.stroke();
			}
		}

		// Vertical converging grid lines
		const fov = width * 0.6;
		const centerX = width / 2;
		for (let x = -width; x < width * 2; x += 110) {
			ctx.beginPath();
			ctx.moveTo(centerX + (x - centerX) * 0.08, horizonY);
			ctx.lineTo(x, height);
			ctx.stroke();
		}

		// Glowing Neon Horizon Beam
		const horizonGrad = ctx.createLinearGradient(0, horizonY, width, horizonY);
		horizonGrad.addColorStop(0, 'transparent');
		horizonGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.4)');
		horizonGrad.addColorStop(1, 'transparent');
		ctx.strokeStyle = horizonGrad;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, horizonY);
		ctx.lineTo(width, horizonY);
		ctx.stroke();

		// 3D Starfield Warp with Streak Lines during high speed (speedMultiplier > 1.2)
		const cx = width / 2;
		const cy = height / 2;
		const isHighSpeed = speed > 1.2;

		for (const star of stars) {
			const prevZ = star.z;
			star.z -= 1.4 * speed;
			if (star.z <= 0) {
				star.z = width;
				star.x = (Math.random() - 0.5) * width * 2.2;
				star.y = (Math.random() - 0.5) * height * 2.2;
			}

			const sx = cx + (star.x / star.z) * fov;
			const sy = cy + (star.y / star.z) * fov;

			if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
				const starSize = Math.max(0.6, (1 - star.z / width) * 3.4 * star.size);
				const alpha = (1 - star.z / width) * star.brightness;

				if (isHighSpeed) {
					const prevSx = cx + (star.x / prevZ) * fov;
					const prevSy = cy + (star.y / prevZ) * fov;
					ctx.strokeStyle = star.color;
					ctx.globalAlpha = alpha;
					ctx.lineWidth = starSize;
					ctx.beginPath();
					ctx.moveTo(prevSx, prevSy);
					ctx.lineTo(sx, sy);
					ctx.stroke();
				} else {
					ctx.fillStyle = star.color;
					ctx.globalAlpha = alpha;
					ctx.beginPath();
					ctx.arc(sx, sy, starSize, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}
		ctx.globalAlpha = 1.0;

		// Floating Tactical Dust Particles with Glow
		for (const p of particles) {
			p.x += p.vx * speed;
			p.y += p.vy * speed;
			p.pulse += 0.04;

			if (p.y < 0) {
				p.y = height;
				p.x = Math.random() * width;
			}
			if (p.x < 0) p.x = width;
			if (p.x > width) p.x = 0;

			const currentAlpha = Math.max(0.1, p.alpha * (0.6 + Math.sin(p.pulse) * 0.4));
			ctx.fillStyle = p.color;
			ctx.globalAlpha = currentAlpha * 0.6;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1.0;

		animId = requestAnimationFrame(renderFrame);
	}
</script>

<canvas bind:this={canvas} class="space-bg-canvas"></canvas>

<style>
	.space-bg-canvas {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
		z-index: 0;
	}
</style>
