<script lang="ts">
	import { onMount } from 'svelte';
	import { playTapSound, playHoverSound } from '$lib/audio';

	let polls: any[] = $state([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const res = await fetch('/api/polls');
			const data = await res.json();
			polls = data.polls || [];
		} catch (e) {
			console.error('Failed to load polls:', e);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>PartyVote | Ad-Free Self-Hosted Party Voting Engine</title>
	<meta name="description" content="Self-hosted, real-time party voting system supporting Ranked Choice, Plurality, Approval, and Score ballots with live TV presentation displays." />
</svelte:head>

<main class="home-space-layout">
	<header class="empire-panel hero-card empire-panel-red">
		<div class="header-status-line">
			<span class="badge badge-active">SYSTEM ONLINE</span>
			<span class="panel-tag">[ IMPERIAL ENGINE v2.0 ]</span>
		</div>
		<h1 class="hero-title">PARTYVOTE ENGINE</h1>
		<p class="hero-subtitle">
			Ad-free self-hosted voting platform for parties, game nights, costume contests, and awards ceremonies.
		</p>
	</header>

	<div class="action-grid">
		<!-- Mobile Ballot Card -->
		<div class="empire-panel empire-panel-interactive feature-card">
			<div class="card-header">
				<span class="panel-tag">[ INTERFACE 01 ]</span>
				<span class="card-icon">📱</span>
			</div>
			<h2>MOBILE BALLOT</h2>
			<p>Guests scan a QR code to submit Ranked Choice, Score, Plurality, or Approval ballots directly from their phone.</p>
			<div class="space-v"></div>
			{#if polls.length > 0}
				<a
					href="/vote/{polls[0].id}"
					class="btn btn-primary full-w"
					onclick={playTapSound}
					onmouseenter={playHoverSound}
				>
					JOIN ACTIVE BALLOT →
				</a>
			{:else}
				<a
					href="/admin"
					class="btn btn-ghost full-w"
					onclick={playTapSound}
					onmouseenter={playHoverSound}
				>
					CREATE POLL FIRST
				</a>
			{/if}
		</div>

		<!-- TV Display Card -->
		<div class="empire-panel empire-panel-interactive empire-panel-cyan feature-card">
			<div class="card-header">
				<span class="panel-tag">[ INTERFACE 02 ]</span>
				<span class="card-icon">📺</span>
			</div>
			<h2>TV DISPLAY</h2>
			<p>Full screen broadcast for TVs and projectors. Features live QR code, guest check-in log, and automated winner reveal ceremonies.</p>
			<div class="space-v"></div>
			{#if polls.length > 0}
				<a
					href="/tv/{polls[0].id}"
					class="btn btn-cyan full-w"
					onclick={playTapSound}
					onmouseenter={playHoverSound}
				>
					LAUNCH TV DISPLAY →
				</a>
			{:else}
				<a
					href="/admin"
					class="btn btn-ghost full-w"
					onclick={playTapSound}
					onmouseenter={playHoverSound}
				>
					CREATE POLL FIRST
				</a>
			{/if}
		</div>

		<!-- Host Admin Card -->
		<div class="empire-panel empire-panel-interactive feature-card">
			<div class="card-header">
				<span class="panel-tag">[ INTERFACE 03 ]</span>
				<span class="card-icon">⚡</span>
			</div>
			<h2>HOST ADMIN</h2>
			<p>Configure custom polls, set category tie-breaking strategies, trigger live reveal steps, and export JSON backups.</p>
			<div class="space-v"></div>
			<a
				href="/admin"
				class="btn full-w"
				onclick={playTapSound}
				onmouseenter={playHoverSound}
			>
				ENTER HOST DASHBOARD →
			</a>
		</div>
	</div>

	<!-- Active Polls Registry -->
	{#if loading}
		<section class="empire-panel">
			<div class="panel-tag">[ SYSTEM INITIALIZING... ]</div>
			<p class="muted-text">Fetching polls registry...</p>
		</section>
	{:else if polls.length > 0}
		<section class="empire-panel">
			<div class="flex-between registry-header">
				<span class="panel-tag">[ ACTIVE POLLS REGISTRY // COUNT: {polls.length} ]</span>
				<a href="/admin" class="btn btn-sm btn-ghost" onclick={playTapSound} onmouseenter={playHoverSound}>+ NEW POLL</a>
			</div>
			<div class="space-v"></div>

			<div class="polls-list">
				{#each polls as poll}
					<div class="poll-row">
						<div class="poll-left">
							<span class="badge {poll.status === 'active' ? 'badge-active' : 'badge-closed'}">
								{poll.status}
							</span>
							<div>
								<h3 class="poll-title-text">{poll.title}</h3>
								{#if poll.description}
									<p class="poll-desc-text">{poll.description}</p>
								{/if}
							</div>
						</div>
						<div class="poll-btns">
							<a
								href="/vote/{poll.id}"
								class="btn btn-sm"
								onclick={playTapSound}
								onmouseenter={playHoverSound}
							>
								VOTE
							</a>
							<a
								href="/tv/{poll.id}"
								class="btn btn-cyan btn-sm"
								onclick={playTapSound}
								onmouseenter={playHoverSound}
							>
								TV
							</a>
							<a
								href="/admin"
								class="btn btn-primary btn-sm"
								onclick={playTapSound}
								onmouseenter={playHoverSound}
							>
								ADMIN
							</a>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<section class="empire-panel empty-polls-panel">
			<div class="panel-tag">[ REGISTRY EMPTY ]</div>
			<h2>NO POLLS CREATED YET</h2>
			<p class="muted-text">Create your first party poll to generate voting QR codes and presentation screens.</p>
			<div class="space-v"></div>
			<a href="/admin" class="btn btn-primary btn-lg" onclick={playTapSound} onmouseenter={playHoverSound}>
				CREATE YOUR FIRST POLL →
			</a>
		</section>
	{/if}
</main>

<style>
	.home-space-layout {
		max-width: 1120px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.hero-card {
		text-align: center;
		padding: 52px 36px;
		display: flex;
		flex-direction: column;
		align-items: center;
		border-color: var(--accent-red);
		background: radial-gradient(circle at 50% 0%, rgba(255, 30, 66, 0.1), transparent 75%), var(--bg-panel);
	}

	.header-status-line {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.hero-title {
		font-size: 3.4rem;
		letter-spacing: 0.08em;
		background: linear-gradient(180deg, #ffffff 40%, #a0a0b2 100%);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	@media (max-width: 680px) {
		.hero-title {
			font-size: 2.2rem;
		}
	}

	.hero-subtitle {
		font-size: 1.1rem;
		color: var(--text-secondary);
		margin-top: 12px;
		max-width: 640px;
		line-height: 1.6;
	}

	.action-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 28px;
	}

	.feature-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		height: 100%;
	}

	.card-header {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.card-icon {
		font-size: 1.5rem;
	}

	.feature-card h2 {
		margin-top: 4px;
		margin-bottom: 12px;
		font-size: 1.35rem;
	}

	.feature-card p {
		color: var(--text-secondary);
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.full-w {
		width: 100%;
		margin-top: auto;
	}

	.muted-text {
		color: var(--text-dim);
		font-size: 0.95rem;
	}

	.registry-header {
		flex-wrap: wrap;
		gap: 12px;
	}

	.polls-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.poll-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		background: var(--bg-panel-elevated);
		border: var(--border-subtle);
		flex-wrap: wrap;
		gap: 16px;
		transition: all 0.2s ease;
	}

	.poll-row:hover {
		border-color: #ffffff;
		transform: translateX(4px);
		box-shadow: 4px 4px 0px rgba(255, 255, 255, 0.1);
	}

	.poll-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.poll-title-text {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.poll-desc-text {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-top: 2px;
	}

	.poll-btns {
		display: flex;
		gap: 10px;
	}

	.empty-polls-panel {
		text-align: center;
		padding: 48px;
	}
</style>
