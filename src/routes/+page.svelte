<script lang="ts">
	import { onMount } from 'svelte';

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
	<title>PartyVote | Ad-Free Self-Hosted Party Voting</title>
</svelte:head>

<main class="home-space-layout">
	<header class="empire-panel hero-card">
		<div class="panel-tag">[ IMPERIAL SYSTEM // VERSION 2.0 ]</div>
		<h1 class="hero-title">PARTYVOTE ENGINE</h1>
		<p class="hero-subtitle">Ad-Free Self-Hosted Custom Party Voting Platform</p>
	</header>

	<div class="action-grid">
		<div class="empire-panel empire-panel-interactive feature-card">
			<div class="panel-tag">[ INTERFACE 01 ]</div>
			<h2>MOBILE BALLOT</h2>
			<p>Guests scan QR code to submit ranked choice, score, or approval ballots from their mobile device.</p>
			<div class="space-v"></div>
			{#if polls.length > 0}
				<a href="/vote/{polls[0].id}" class="btn btn-primary full-w">JOIN ACTIVE BALLOT</a>
			{:else}
				<p class="muted-text">No active polls found.</p>
			{/if}
		</div>

		<div class="empire-panel empire-panel-interactive feature-card">
			<div class="panel-tag">[ INTERFACE 02 ]</div>
			<h2>TV DISPLAY</h2>
			<p>Display live QR code, voter log, and auto-play sequential winner reveal ceremony.</p>
			<div class="space-v"></div>
			{#if polls.length > 0}
				<a href="/tv/{polls[0].id}" class="btn btn-cyan full-w">OPEN TV DISPLAY</a>
			{:else}
				<p class="muted-text">Create a poll in Admin first.</p>
			{/if}
		</div>

		<div class="empire-panel empire-panel-interactive feature-card">
			<div class="panel-tag">[ INTERFACE 03 ]</div>
			<h2>HOST ADMIN</h2>
			<p>Create custom polls, set voting strategies, and control the winner presentation.</p>
			<div class="space-v"></div>
			<a href="/admin" class="btn full-w">LAUNCH ADMIN</a>
		</div>
	</div>

	{#if polls.length > 0}
		<section class="empire-panel">
			<div class="panel-tag">[ ACTIVE POLLS REGISTRY // COUNT: {polls.length} ]</div>
			<div class="space-v"></div>

			<div class="polls-list">
				{#each polls as poll}
					<div class="poll-row">
						<div class="poll-left">
							<h3>{poll.title}</h3>
							<span class="badge {poll.status === 'active' ? 'badge-active' : 'badge-closed'}">
								{poll.status}
							</span>
						</div>
						<div class="poll-btns">
							<a href="/vote/{poll.id}" class="btn btn-sm">VOTE</a>
							<a href="/tv/{poll.id}" class="btn btn-cyan btn-sm">TV DISPLAY</a>
							<a href="/admin" class="btn btn-primary btn-sm">ADMIN</a>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</main>

<style>
	.home-space-layout {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.hero-card {
		text-align: center;
		padding: 56px 40px;
		display: flex;
		flex-direction: column;
		align-items: center;
		border-color: var(--accent-red);
	}

	.hero-title {
		font-size: 3.5rem;
		letter-spacing: 0.08em;
	}

	.hero-subtitle {
		font-size: 1.15rem;
		color: var(--text-secondary);
		margin-top: 8px;
		max-width: 600px;
	}

	.action-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 32px;
	}

	.feature-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.full-w {
		width: 100%;
		margin-top: auto;
	}

	.muted-text {
		color: var(--text-dim);
		font-size: 0.9rem;
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
		border: var(--border-muted);
		flex-wrap: wrap;
		gap: 16px;
	}

	.poll-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.poll-btns {
		display: flex;
		gap: 10px;
	}

	.btn-sm {
		padding: 10px 18px;
		font-size: 0.8rem;
	}
</style>
