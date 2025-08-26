document.addEventListener("DOMContentLoaded", async function () {
  let bundleInfo = {};
  let productIds = [];
  let settings = {};

  let backendUrl = bkdUrl || "https://startbit-product-bundler.onrender.com";
  // Logic to display bundle product

  if (productId && backendUrl) {
    try {
      // Fetch the bundle data
      const response = await fetch(
        `${backendUrl}/api/fetchBundle/${productId}?shop=${shopDomain}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      const bundleData = await response.json();

      if (bundleData.success && bundleData?.bundle?.status === true) {
        // Populate productIds from the bundle data
        productIds = bundleData.bundle.bundle_products.map((product) =>
          product.product_id.split("/").pop(),
        );
        bundleInfo = bundleData.bundle;
      } else {
        console.log(bundleData.message); // Handle no bundle found
      }
    } catch (error) {
      console.error("Error fetching bundle:", error);
    }

    // fetch settings from settings model
    try {
      const response = await fetch(`${backendUrl}/api/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: shopDomain,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      widgetSettings = await response.json();

      if (widgetSettings.error) {
        throw new Error(widgetSettings.error);
      }

      console.log("Bundle settings loaded successfully:", widgetSettings);
      createBundleCSSVariables(widgetSettings);
    } catch (error) {
      console.error("Failed to fetch bundle settings:", error);
    }
  }
  
  // Ensure productIds is not empty before making the next request
  if (productIds.length > 0 && bundleInfo.bundle_products) {
    
    // display bundle widget
    document.getElementById("sbpbBundle").style.display = "block";

    if (productIds.length === 3)
      document.getElementById("sbpbBundle").style.width = "720px";
    else document.getElementById("sbpbBundle").style.width = "500px";

    const allProductData = [];
    // Fetch each product's data using its handle
    for (const item of bundleInfo.bundle_products) {
      const handle = item.handle;
      try {
        // Build query string
        const res = await fetch(
          `${window.Shopify.routes.root}products/${handle}.js`,
        );
        if (!res.ok) throw new Error("Failed to fetch product " + handle);
        const product = await res.json();
        allProductData.push(product);
      } catch (error) {
        console.error("Error loading product with handle:", handle, error);
      }
    }

    // Call the displayBundle function to populate the HTML
    displayBundle(allProductData, bundleInfo, productIds, widgetSettings);
  }
});

// Function to display the bundle on the page
function displayBundle(shopifyData, bundleInfo, productIds, settings) {
 const { discountAmount, discountType } = bundleInfo;

  let totalOriginalPrice = 0;
  let totalDiscountedPrice = 0;

  const currencyCode = window.Shopify?.currency?.active || "USD";
  const currency = getCurrencySymbol(currencyCode);

  // Build product blocks HTML
  let productsHTML = "";

  shopifyData.forEach((product) => {
    const imageSrc = product.images?.[0] || "";
    const productTitle = product.title;
    const rawPrice = product.variants[0].price;
    const productPrice =
      typeof rawPrice === "string" ? parseFloat(rawPrice) : rawPrice / 100;
    const variants = product.variants.map(
      (variant) => `<option value="${variant.id}">${variant.title}</option>`
    );

    // Discounted price
    const productDiscount =
      discountType === "percent"
        ? (productPrice * discountAmount) / 100
        : discountAmount / shopifyData.length;

    const productDiscountedPrice = productPrice - productDiscount;

    totalOriginalPrice += productPrice;
    totalDiscountedPrice += productDiscountedPrice;

    productsHTML += `
      <div class="sbpb-bundle-product-block">
        <div class="sbpb-image-section">
          <img src="${imageSrc}" alt="${productTitle}" />
        </div>
        <div class="sbpb-product-title">${productTitle}</div>
        <div class="sbpb-product-price">
          ${
            discountType === "percent"
              ? `<span class="sbpb-original-price">${currency} ${productPrice.toFixed(
                  2
                )}</span>
                 <span class="sbpb-sale-price">${currency} ${productDiscountedPrice.toFixed(
                   2
                 )}</span>`
              : `<span class="sbpb-sale-price">${currency} ${productPrice.toFixed(
                  2
                )}</span>`
          }
        </div>
        <div class="sbpd-product-variant">
          <select name="product_variant">
            ${variants.join("")}
          </select>
        </div>
      </div>
    `;
  });

  // Totals
  let finalTotal = totalOriginalPrice;
  if (discountType === "fix") {
    finalTotal = totalOriginalPrice - discountAmount;
  }

  const totalsHTML = `
    <div class="sbpb-product-price">
      Total: <span class="sbpb-original-price">${currency} ${totalOriginalPrice.toFixed(
        2
      )}</span>
      <span class="sbpb-sale-price">
        ${currency} ${(discountType === "percent" ? totalDiscountedPrice : finalTotal).toFixed(2)}
      </span>
    </div>
  `;

  // Full widget HTML in one variable
  const widgetHTML = `
    <h2>${bundleInfo.heading || "Buy both cakes and save 25%!"}</h2>
    <h6>${bundleInfo.subHeading || "Better have two cakes than one"}</h6>
    <div id="widget-block">
      <div id="bundle-widget-container">${productsHTML}</div>
      <div id="sbpb-total">${totalsHTML}</div>
    </div>
    <div class="sbpb-quantity-cart">
      <div class="sbpb-quantity">
        <label for="quantity">Quantity</label>
        <input type="number" name="quantity" value="1" class="sbpb-input-quantity">
      </div>
      <div class="sbpb-add-to-cart">
        <button type="submit" onClick="addBundleToCart(this)" class="sbpb-bundle-button">
          <span class="button-text">Add both to cart</span>
          <span class="spinner" style="display:none;"></span>
        </button>
      </div>
    </div>
  `;

  // Inject everything into root div
  document.getElementById("sbpbBundle").innerHTML = widgetHTML;

  // Convert the array to a comma-separated string
    const productIdsString = productIds.join(",");
    const { name } = bundleInfo;
    // Set the `id` attribute of the button
    const button = document.querySelector(".sbpb-bundle-button");
    const buttonText = document.querySelector(".sbpb-bundle-button .button-text");
    if (button) {
      button.setAttribute("data-product-ids", productIdsString);
      button.setAttribute("data-discount", discountAmount);
      button.setAttribute("data-bundle-name", name);
      button.setAttribute("data-discount-type", discountType);
      if (productIds.length > 2) {
        buttonText.textContent = settings?.buttonText ?? "Add all to cart";
      } else {
        buttonText.textContent = settings?.buttonText ?? "Add to cart";
      }
    }
}

// ADD TO CART FEATURE

async function addBundleToCart(button) {
  // Show spinner and disable button
  const buttonText = button.querySelector('.button-text');
  const spinner = button.querySelector('.spinner');
  
  buttonText.style.display = 'none';
  spinner.style.display = 'inline-block';
  buttonText.disabled = true;

  // Get the product IDs from the data attribute
  const productIds = button.getAttribute("data-product-ids").split(",");
  const discountPercentage = button.getAttribute("data-discount");
  const discountType = button.getAttribute("data-discount-type");
  const bundleName = button.getAttribute("data-bundle-name");

  const selectedVariants = [];

  // Iterate through product blocks to get selected variant IDs
  const productBlocks = document.querySelectorAll(".sbpb-bundle-product-block");
  const productQuantity = document.querySelector(".sbpb-input-quantity");

  productBlocks.forEach((block, index) => {
    const selectElement = block.querySelector("select[name='product_variant']");
    const selectedVariantId = selectElement.value;

    if (selectedVariantId) {
      const quantity = parseInt(productQuantity.value, 10) || 1;
      selectedVariants.push({
        id: selectedVariantId,
        quantity: quantity,
        properties: {
          _bundleDiscount: JSON.stringify({
            ids: productIds,
            type: discountType,
            value: discountPercentage,
          }), // Custom property
          bundleName: bundleName,
        },
      });
    }
  });

  // Verify if variants are selected
  if (selectedVariants.length === 0) {
    alert("Please select variants for all bundle items.");
    return;
  }

  // Log selected variants for debugging
  //console.log("Selected Variants:", selectedVariants);

  try {
    // Send a POST request to the Shopify cart API
    const response = await fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: selectedVariants,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error adding items to cart: ${response.statusText}`);
    }

    const cart = await response.json();
    console.log("Cart updated:", cart);

    // Update cart attributes
    await updateCartAttributes({
      _bundleDiscount: JSON.stringify({
        ids: productIds,
        type: discountType,
        value: discountPercentage,
      }),
    });

    // Optionally redirect to the cart page
    window.location.href = "/cart";
  } catch (error) {
    console.error("Error adding bundle to cart:", error);
  }
}

async function updateCartAttributes(attributes) {
  try {
    const response = await fetch("/cart/update.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attributes: attributes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error updating cart attributes: ${response.statusText}`);
    }

    const cart = await response.json();
    console.log("Cart attributes updated:", cart);
  } catch (error) {
    console.error("Error updating cart attributes:", error);
  }
}

// Function to create CSS variables from settings
function createBundleCSSVariables(settingsObj) {
  const root = document.documentElement;

  // Apply theme color
  if (settingsObj.themeColor) {
    root.style.setProperty("--bundle-theme-color", settingsObj.themeColor);
    // Create hover version (slightly darker)
    const hoverColor = settingsObj.themeColor;
    root.style.setProperty("--bundle-theme-color-hover", hoverColor);
  }

  // Apply text color
  if (settingsObj.textColor) {
    root.style.setProperty("--bundle-text-color", settingsObj.textColor);
  }

  // Apply font sizes (add 'px' if not present)
  if (settingsObj.headingFontSize) {
    const headingSize = settingsObj.headingFontSize.toString().includes("px")
      ? settingsObj.headingFontSize
      : `${settingsObj.headingFontSize}px`;
    root.style.setProperty("--bundle-heading-font-size", headingSize);
  }

  if (settingsObj.bodyFontSize) {
    const bodySize = settingsObj.bodyFontSize.toString().includes("px")
      ? settingsObj.bodyFontSize
      : `${settingsObj.bodyFontSize}px`;
    root.style.setProperty("--bundle-body-font-size", bodySize);
  }

  // Apply border settings (add 'px' if not present)
  if (settingsObj.borderThickness) {
    const borderSize = settingsObj.borderThickness.toString().includes("px")
      ? settingsObj.borderThickness
      : `${settingsObj.borderThickness}px`;
    root.style.setProperty("--bundle-border-thickness", borderSize);
  }

  if (settingsObj.borderRadius) {
    const radiusSize = settingsObj.borderRadius.toString().includes("px")
      ? settingsObj.borderRadius
      : `${settingsObj.borderRadius}px`;
    root.style.setProperty("--bundle-border-radius", radiusSize);
  }

  // Set additional derived colors
  root.style.setProperty(
    "--bundle-border-color",
    settingsObj.themeColor || "#4667A7",
  );
  root.style.setProperty("--bundle-border-color-light", "#464f68");
}

function getCurrencySymbol(currencyCode) {
  return (0).toLocaleString('en', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).replace(/\d/g, '').trim();
}