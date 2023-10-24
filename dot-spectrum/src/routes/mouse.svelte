<script lang="ts">
	import { onMount } from "svelte";

  onMount(() => {
    const isMobile = () => {
      const regex = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      return regex.test(navigator.userAgent);
    }

    if (!isMobile()) {
      let ok = true;
      const player = document.querySelector("#player") as Element;
      player.addEventListener("mouseenter", () => ok = false, false);
      player.addEventListener("mouseleave", () => ok = true, false);

      const mouse = document.querySelector("#js-mouse") as HTMLDivElement;
      const style = window.getComputedStyle(mouse);
      const width = parseInt(style.width);
      const height = parseInt(style.height);
      window.onmousemove = (e) => {
        const x = e.clientX;
        const y = e.clientY;
        mouse.style.opacity = ok ? "1" : "0";
        mouse.style.transform = `translate(${x - x % width}px, ${y - y % height}px)`;
      }

      const hoverTargets = document.querySelectorAll("a,button,input,select");

      hoverTargets.forEach(target => {
        target.addEventListener("mouseenter", () => {
          mouse.classList.add("js-hover");
        }, false);
        target.addEventListener("mouseleave", () => {
          mouse.classList.remove("js-hover");
        }, false);
      });
    }
  })
</script>

<div id="js-mouse"></div>
