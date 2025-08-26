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

      settings = await response.json();

      if (settings.error) {
        throw new Error(settings.error);
      }

      console.log("Bundle settings loaded successfully:", settings);
      createBundleCSSVariables(settings);
    } catch (error) {
      console.error("Failed to fetch bundle settings:", error);
    }
  }

  // Ensure productIds is not empty before making the next request
  if (productIds.length > 0 && bundleInfo.bundle_products) {
    // Convert the array to a comma-separated string
    const productIdsString = productIds.join(",");
    const { discountAmount, discountType, name } = bundleInfo;
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
    displayBundle(allProductData, bundleInfo);
  }
});

// Function to display the bundle on the page
function displayBundle(shopifyData, bundleInfo) {
  const { discountAmount, discountType } = bundleInfo;

  // Select the container to populate products
  const container = document.getElementById("bundle-widget-container");
  container.innerHTML = ""; // Clear existing content

  let totalOriginalPrice = 0;
  let totalDiscountedPrice = 0;

  // Initialize currency and safely check if available in the first product
  const currencyCode = window.Shopify.currency.active || "USD"; // Default value in case of missing data
  const currency = getCurrencySymbol(currencyCode);

  // Loop through Shopify data and populate the HTML
  shopifyData.forEach((product, index) => {
    const imageSrc = product.images?.[0] || "";
    const productTitle = product.title;
    const rawPrice = product.variants[0].price;
    const productPrice =
      typeof rawPrice === "string" ? parseFloat(rawPrice) : rawPrice / 100;
    const variants = product.variants.map((variant) => ({
      id: variant?.id, // Variant ID
      title: variant.title, // Variant title
    }));

    // Calculate discounted price for this product
    const productDiscount =
      discountType === "percent"
        ? (productPrice * discountAmount) / 100
        : discountAmount / shopifyData.length;
    const productDiscountedPrice = productPrice - productDiscount;

    // Add product prices to totals
    totalOriginalPrice += productPrice;
    totalDiscountedPrice += productDiscountedPrice;

    // Create product block
    const productBlock = document.createElement("div");
    productBlock.classList.add("sbpb-bundle-product-block");

    productBlock.innerHTML = `
        <div class="sbpb-image-section">
          <img src="${imageSrc}" alt="${productTitle}" />
        </div>
        <div class="sbpb-product-title">${productTitle}</div>
        <div class="sbpb-product-price">
        ${
          discountType === "percent"
            ? `<span class="sbpb-original-price">${currency} ${productPrice.toFixed(2)}</span>
            <span class="sbpb-sale-price">${currency} ${productDiscountedPrice.toFixed(2)}</span>`
            : `<span class="sbpb-sale-price">${currency} ${productPrice.toFixed(2)}</span>`
        }          
        </div>
        <div class="sbpd-product-variant">
          <select name="product_variant">
            ${variants.map((variant) => `<option value="${variant.id}">${variant.title}</option>`).join("")}
          </select>
        </div>
      `;

    container.appendChild(productBlock);
  });

  let totalFixDiscountedPrice = totalOriginalPrice;
  if (discountType === "fix") {
    totalFixDiscountedPrice = totalOriginalPrice - discountAmount;
  }

  const totalContainer = document.getElementById("sbpb-total");
  totalContainer.innerHTML = `
      <div class="sbpb-product-price">
        Total: <span class="sbpb-original-price">${currency} ${totalOriginalPrice.toFixed(2)}</span>
        ${
          discountType === "percent"
            ? `
        <span class="sbpb-sale-price">${currency} ${totalDiscountedPrice.toFixed(2)}</span>`
            : `<span class="sbpb-sale-price">${currency} ${totalFixDiscountedPrice.toFixed(2)}</span>`
        }
      </div>
    `;
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