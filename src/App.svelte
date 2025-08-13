<script>
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import Tailwind from "./Tailwind.svelte";
  import PDFPage from "./PDFPage.svelte";

  import Text from "./Text.svelte";
  import Drawing from "./Drawing.svelte";
  import DrawingCanvas from "./DrawingCanvas.svelte";
  import prepareAssets, { fetchFont } from "./utils/prepareAssets.js";
  import {
    readAsArrayBuffer,
    readAsPDF
  } from "./utils/asyncReader.js";
  import { ggID } from "./utils/helper.js";
  import { save } from "./utils/PDF.js";
  const genID = ggID();
  let pdfFile;
  let pdfName = "";
  let pages = [];
  let pagesScale = [];
  let allObjects = [[]]; // Initialize with at least one empty page array
  let currentFont = "Times-Roman";
  let signatureFont = "Satisfy";
  let focusId = null;
  let selectedPageIndex = -1;
  let saving = false;
  let addingDrawing = false;
  let addingSignature = false;
  let signatureText = "";
  // for test purpose
  onMount(async () => {
    try {
      const res = await fetch("/test.pdf");
      const pdfBlob = await res.blob();
      await addPDF(pdfBlob);
      selectedPageIndex = 0;
      setTimeout(() => {
        fetchFont(currentFont);
        prepareAssets();
      }, 5000);
      
      // Load the default signature font
      try {
        await fetchFont(signatureFont);
      } catch (e) {
        console.log(`Default font ${signatureFont} not available, using fallback`);
        signatureFont = 'Times-Roman';
      }

      // addTextField("測試!");
      // addDrawing(200, 100, "M30,30 L100,50 L50,70", 0.5);
    } catch (e) {
      console.log(e);
    }
  });
  async function onUploadPDF(e) {
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    const file = files[0];
    if (!file || file.type !== "application/pdf") return;
    selectedPageIndex = -1;
    try {
      await addPDF(file);
      selectedPageIndex = 0;
    } catch (e) {
      console.log(e);
    }
  }
  async function addPDF(file) {
    try {
      const pdf = await readAsPDF(file);
      pdfName = file.name;
      pdfFile = file;
      const numPages = pdf.numPages;
      pages = Array(numPages)
        .fill()
        .map((_, i) => pdf.getPage(i + 1));
      allObjects = pages.map(() => []);
      pagesScale = Array(numPages).fill(1);
    } catch (e) {
      console.log("Failed to add pdf.");
      throw e;
    }
  }

  function onAddTextField() {
    if (selectedPageIndex >= 0) {
      addTextField();
    }
  }
  function addTextField(text = "New Text Field") {
    const id = genID();
    fetchFont(currentFont);
    const object = {
      id,
      text,
      type: "text",
      size: 16,
      width: 0, // recalculate after editing
      lineHeight: 1.4,
      fontFamily: currentFont,
      x: 0,
      y: 0
    };
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects
    );
  }
  function onAddDrawing() {
    if (selectedPageIndex >= 0) {
      addingDrawing = true;
    }
  }
  function addDrawing(originWidth, originHeight, path, scale = 1) {
    const id = genID();
    const object = {
      id,
      path,
      type: "drawing",
      x: 0,
      y: 0,
      originWidth,
      originHeight,
      width: originWidth * scale,
      scale
    };
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects
    );
  }
  
  async function addTypedSignature(text) {
    const id = genID();
    
    // Try to fetch the selected font
    try {
      await fetchFont(signatureFont);
      console.log(`Font ${signatureFont} loaded successfully for signature`);
    } catch (e) {
      console.log(`Font ${signatureFont} not available, using fallback`);
      signatureFont = 'Times-Roman';
    }
    
    const object = {
      id,
      text,
      type: "text",
      size: 28,
      width: text.length * 28 * 0.8, // Estimate width for signature font (more space for cursive)
      lineHeight: 1.2,
      fontFamily: signatureFont,
      x: 300, // Position signature in center area
      y: 400, // Position signature in center area
      lines: [text] // Add lines property for PDF rendering
    };
    
    console.log('Signature object created:', JSON.stringify(object, null, 2));
    
    console.log('Created signature object:', object);
    console.log('Current selectedPageIndex:', selectedPageIndex);
    console.log('Current allObjects:', allObjects);
    
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects
    );
    
    console.log('Updated allObjects:', allObjects);
    console.log('Objects on selected page:', allObjects[selectedPageIndex]);
  }
  function selectFontFamily(event) {
    const name = event.detail.name;
    fetchFont(name);
    currentFont = name;
  }
  function selectPage(index) {
    selectedPageIndex = index;
  }
  function updateObject(objectId, payload) {
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex == selectedPageIndex
        ? objects.map(object =>
            object.id === objectId ? { ...object, ...payload } : object
          )
        : objects
    );
  }
  function deleteObject(objectId) {
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex == selectedPageIndex
        ? objects.filter(object => object.id !== objectId)
        : objects
    );
  }
  function onMeasure(scale, i) {
    pagesScale[i] = scale;
  }
  // FIXME: Should wait all objects finish their async work
  async function savePDF() {
    if (!pdfFile || saving || !pages.length) return;
    saving = true;
    try {
      console.log('Saving PDF with objects:', allObjects);
      console.log('Number of pages:', pages.length);
      console.log('Objects per page:', allObjects.map((objects, i) => `Page ${i}: ${objects.length} objects`));
      console.log('Selected page index:', selectedPageIndex);
      await save(pdfFile, allObjects, pdfName, pagesScale);
    } catch (e) {
      console.log(e);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window
  on:dragenter|preventDefault
  on:dragover|preventDefault
  on:drop|preventDefault={onUploadPDF} />
<Tailwind />
<main class="flex flex-col items-center py-16 bg-gray-100 min-h-screen">
  <div
    class="fixed z-10 top-0 left-0 right-0 h-12 flex justify-center items-center
    bg-gray-200 border-b border-gray-300">
    <input
      type="file"
      name="pdf"
      id="pdf"
      on:change={onUploadPDF}
      class="hidden" />

    <label
      class="whitespace-no-wrap bg-blue-500 hover:bg-blue-700 text-white
      font-bold py-1 px-3 md:px-4 rounded mr-3 cursor-pointer md:mr-4"
      for="pdf">
      Choose PDF
    </label>
    <div
      class="relative mr-3 flex flex-row items-center gap-3 md:mr-4">

      <label
        class="flex flex-row items-center justify-center py-1 px-3 md:px-4 w-14 h-14 bg-gray-400 hover:bg-gray-500
        cursor-pointer rounded-sm transition-colors"
        for="text"
        class:cursor-not-allowed={selectedPageIndex < 0}
        class:bg-gray-500={selectedPageIndex < 0}
        on:click={onAddTextField}>
        <img src="notes.svg" alt="An icon for adding text" class="w-5 h-5 mb-1" />
        <span class="text-xs text-gray-700 font-medium">Text</span>
      </label>
      <label
        class="flex flex-row items-center justify-center py-1 px-3 md:px-4 w-14 h-14 bg-gray-400 hover:bg-gray-500
        cursor-pointer rounded-sm transition-colors"
        on:click={() => {
          console.log('Signature button clicked, selectedPageIndex:', selectedPageIndex);
          if (selectedPageIndex >= 0) {
            addingSignature = true;
            signatureText = " "; // Initialize with space to show typing interface
          } else {
            console.log('No page selected, cannot add signature');
          }
        }}
        class:cursor-not-allowed={selectedPageIndex < 0}
        class:bg-gray-500={selectedPageIndex < 0}>
        <img src="gesture.svg" alt="An icon for adding signature" class="w-5 h-5 mb-1" />
        <span class="text-xs text-gray-700 font-medium">Signature</span>
      </label>
    </div>

    <button
      on:click={savePDF}
      class="w-20 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3
      md:px-4 mr-3 md:mr-4 rounded"
      class:cursor-not-allowed={pages.length === 0 || saving || !pdfFile}
      class:bg-blue-700={pages.length === 0 || saving || !pdfFile}>
      {saving ? 'Saving' : 'Save'}
    </button>
  </div>
  {#if addingDrawing}
    <div
      transition:fly={{ y: -200, duration: 500 }}
      class="fixed z-10 top-0 left-0 right-0 border-b border-gray-300 bg-white
      shadow-lg"
      style="height: 50%;">
      <DrawingCanvas
        on:finish={e => {
          const { originWidth, originHeight, path } = e.detail;
          let scale = 1;
          if (originWidth > 500) {
            scale = 500 / originWidth;
          }
          addDrawing(originWidth, originHeight, path, scale);
          addingDrawing = false;
        }}
        on:cancel={() => (addingDrawing = false)} />
    </div>
  {/if}
  
  {#if addingSignature}
    <div
      transition:fly={{ y: -200, duration: 500 }}
      class="fixed z-10 top-0 left-0 right-0 border-b border-gray-300 bg-white
      shadow-lg"
      style="height: 50%;">
      <div class="flex flex-col items-center justify-center h-full p-6">
        <h3 class="text-lg font-semibold mb-4">Add Signature</h3>
        
        <!-- Font Selection -->
        <div class="w-full max-w-md mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Signature Style:</label>
                           <select
                   bind:value={signatureFont}
                   class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                   on:change={async () => {
                     try {
                       await fetchFont(signatureFont);
                     } catch (e) {
                       console.log(`Font ${signatureFont} not available, using fallback`);
                       signatureFont = 'Times-Roman';
                     }
                   }}>
                   <option value="Satisfy">Satisfy (Signature)</option>
                   <option value="Times-Roman">Times-Roman</option>
                   <option value="Helvetica">Helvetica</option>
                   <option value="Courier">Courier</option>
                   <option value="標楷體">標楷體 (Chinese)</option>
                 </select>
        </div>
        
        <!-- Text Input -->
        <input
          type="text"
          bind:value={signatureText}
          placeholder="Enter your signature"
          class="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md text-lg mb-4"
          style="font-family: '{signatureFont}', serif; font-size: 24px; color: #374151;"
          on:keydown={async (e) => {
            if (e.key === 'Enter' && signatureText.trim()) {
              await addTypedSignature(signatureText.trim());
              signatureText = "";
              addingSignature = false; // Close the modal
            }
          }} />
        
        <!-- Preview -->
        {#if signatureText.trim()}
          <div class="w-full max-w-md mb-4 p-3 border border-gray-200 rounded-md bg-gray-50">
            <label class="block text-sm font-medium text-gray-700 mb-2">Preview:</label>
            <div 
              class="text-center"
              style="font-family: '{signatureFont}', serif; font-size: 24px; color: #374151;">
              {signatureText}
            </div>
          </div>
        {/if}
        
        <!-- Action Buttons -->
        <div class="flex gap-3">
          <button
            on:click={() => {
              addingSignature = false;
              addingDrawing = true;
            }}
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
            ✏️ Draw Instead
          </button>
          <button
            on:click={() => addingSignature = false}
            class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
            Cancel
          </button>
          <button
            on:click={async () => {
              if (signatureText.trim()) {
                await addTypedSignature(signatureText.trim());
                signatureText = "";
                addingSignature = false; // Close the modal
              }
            }}
            class="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            disabled={!signatureText.trim()}>
            Add Signature
          </button>
        </div>
      </div>
    </div>
  {/if}
  {#if pages.length}

    <div class="w-full">
      {#each pages as page, pIndex (page)}
        <div
          class="p-5 w-full flex flex-col items-center overflow-hidden"
          on:mousedown={() => selectPage(pIndex)}
          on:touchstart={() => selectPage(pIndex)}>
          <div
            class="relative shadow-lg"
            class:shadow-outline={pIndex === selectedPageIndex}>
            <PDFPage
              on:measure={e => onMeasure(e.detail.scale, pIndex)}
              {page} />
            <div
              class="absolute top-0 left-0 transform origin-top-left"
              style="transform: scale({pagesScale[pIndex]}); touch-action: none;">
              {#each (allObjects[pIndex] || []) as object (object.id)}
                {#if object.type === 'text'}
                  <Text
                    on:update={e => updateObject(object.id, e.detail)}
                    on:delete={() => deleteObject(object.id)}
                    on:selectFont={selectFontFamily}
                    text={object.text}
                    x={object.x}
                    y={object.y}
                    size={object.size}
                    lineHeight={object.lineHeight}
                    fontFamily={object.fontFamily}
                    pageScale={pagesScale[pIndex]} />

                {:else if object.type === 'drawing'}
                  <Drawing
                    on:update={e => updateObject(object.id, e.detail)}
                    on:delete={() => deleteObject(object.id)}
                    path={object.path}
                    x={object.x}
                    y={object.y}
                    width={object.width}
                    originWidth={object.originWidth}
                    originHeight={object.originHeight}
                    pageScale={pagesScale[pIndex]} />
                {/if}
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="w-full flex-grow flex justify-center items-center">
      <span class=" font-bold text-3xl text-gray-500">Drag something here</span>
    </div>
  {/if}
</main>
