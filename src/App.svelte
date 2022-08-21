<script>
  import {fade,fly,scale,slide} from"svelte/transition";
  import browser from "webextension-polyfill";
  import {chromeStorageLocal} from "svelte-chrome-storage"
  import Dashboard from "./Dashboard.svelte";
    let user = chromeStorageLocal("user")
    $:user ={
		name:"Rohit",
		username:"rb",
		loggedin:false,
	}
  
</script>

<main>
  <a href="/Login">
    <button>Login with Github</button>
  </a>
  {#if user.loggedin}
		<div in:fade>
		<Dashboard  on:logout={()=>user.loggedin=false} {...user}/>
		</div>
		{:else}
		<button in:fly={{x:200}} on:click={() => user.loggedin=true}>Login</button>
	{/if}
</main>

<style>
main{
	flex-flow: column;
	flex: content;
	background-color: aquamarine;
	width:200px;
  /* height: 100px; */
  margin-bottom: 100px;
}
</style>