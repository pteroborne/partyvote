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
	}

	interface Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		alpha: number;
	}

	let stars: Star[] = [];
	let particles: Particle[] = [];
	let gridOffset = 0;

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
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	function initScene() {
		resizeCanvas();
		if (!canvas) return;

		const numStars = 120;
		stars = [];
		for (let i = 0; i < numStars; i++) {
			stars.push({
				x: (Math.random() - 0.5) * canvas.width * 2,
				y: (Math.random() - 0.5) * canvas.height * 2,
				z: Math.random() * canvas.width,
				size: Math.random() * 1.5 + 0.5,
				brightness: Math.random() * 0.7 + 0.3
			});
		}

		const numParticles = 30;
		particles = [];
		for (let i = 0; i < numParticles; i++) {
			particles.push({
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height,
				vx: (Math.random() - 0.5) * 0.4,
				vy: -Math.random() * 0.6 - 0.2,
				size: Math.random() * 2 + 1,
				alpha: Math.random() * 0.5 + 0.2
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

		// Clear canvas with space backdrop
		ctx.fillStyle = '#060608';
		ctx.fillRect(0, 0, width, height);

		// Render Moving Space Perspective Grid
		gridOffset = (gridOffset + 0.3 * speed) % 40;
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
		ctx.lineWidth = 1;

		// Horizontal perspective lines
		const horizonY = height * 0.4;
		for (let y = horizonY; y < height; y += 40) {
			const py = y + gridOffset;
			if (py < height) {
				ctx.beginPath();
				ctx.moveTo(0, py);
				ctx.lineTo(width, py);
				ctx.stroke();
			}
		}

		// Vertical converging lines
		const fov = width * 0.5;
		const centerX = width / 2;
		for (let x = -width; x < width * 2; x += 80) {
			ctx.beginPath();
			ctx.moveTo(centerX + (x - centerX) * 0.1, horizonY);
			ctx.lineTo(x, height);
			ctx.stroke();
		}

		// Render 3D Starfield Warp
		const cx = width / 2;
		const cy = height / 2;

		for (const star of stars) {
			star.z -= 0.8 * speed;
			if (star.z <= 0) {
				star.z = width;
				star.x = (Math.random() - 0.5) * width * 2;
				star.y = (Math.random() - 0.5) * height * 2;
			}

			const sx = cx + (star.x / star.z) * fov;
			const sy = cy + (star.y / star.z) * fov;

			if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
				const starSize = Math.max(0.5, (1 - star.z / width) * 2.5 * star.size);
				const alpha = (1 - star.z / width) * star.brightness;

				ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
				ctx.beginPath();
				ctx.arc(sx, sy, starSize, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		// Render Faint Imperial Tactical Particles
		for (const p of particles) {
			p.x += p.vx * speed;
			p.y += p.vy * speed;

			if (p.y < 0) {
				p.y = height;
				p.x = Math.random() * width;
			}
			if (p.x < 0) p.x = width;
			if (p.x > width) p.x = 0;

			ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha * 0.6})`;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
		}

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
