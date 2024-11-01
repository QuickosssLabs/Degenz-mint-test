const canvas = document.getElementById('characterCanvas');
const ctx = canvas.getContext('2d');
let selections = {};
let data = {};

// Désactiver l'anticrénelage pour un rendu net en pixel art
ctx.imageSmoothingEnabled = false;

// Fonction pour charger les données du fichier JSON et créer les menus dynamiquement
async function loadTraits() {
    const response = await fetch('traits.json');
    data = await response.json();

    const menuContainer = document.querySelector('.menu-container');
    menuContainer.innerHTML = '';  // Efface les anciens éléments de menu

    for (const [trait, options] of Object.entries(data)) {
        selections[trait] = null;

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';

        const button = document.createElement('button');
        button.className = 'dropbtn';
        button.textContent = trait.charAt(0).toUpperCase() + trait.slice(1);
        dropdown.appendChild(button);

        const content = document.createElement('div');
        content.className = 'dropdown-content';
        content.id = `${trait}Menu`;

        options.forEach(option => {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.dataset.value = option.value;
            div.innerHTML = `<img src="${option.img}" alt="${option.value}"> ${option.name}`;
            div.addEventListener('click', () => updateSelection(trait, option.value));
            content.appendChild(div);
        });

        dropdown.appendChild(content);
        menuContainer.appendChild(dropdown);
    }
    randomizeSelections();  // Appel initial pour des sélections aléatoires
}

// Fonction pour dessiner le personnage
function drawCharacter() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const traits = ['background', 'type', 'glasses', 'tophead', 'neck'];
    let currentTrait = 0;

    function drawNextTrait() {
        if (currentTrait >= traits.length) return;
    
        const trait = traits[currentTrait];
        const value = selections[trait];
        if (!value) {
            currentTrait++;
            drawNextTrait();
            return;
        }
    
        const img = new Image();
        img.src = `images/${trait}/${value}.png`;
        img.onload = () => {
            ctx.drawImage(
                img,
                0, 0, img.width, img.height,
                0, 0, canvas.width, canvas.height
            );
            currentTrait++;
            drawNextTrait(); // Appel après chargement de l'image
        };
        img.onerror = () => {
            console.error(`Erreur lors du chargement de l'image pour ${trait} avec la valeur ${value}`);
            currentTrait++;
            drawNextTrait(); // Passe au trait suivant en cas d'erreur
        };
    }

    drawNextTrait();
}

// Fonction pour mettre à jour la sélection
function updateSelection(layer, value) {
    selections[layer] = value;
    drawCharacter();  // Redessine le canvas
}

// Fonction pour sélectionner aléatoirement une couche
function randomizeSelections() {
    for (const trait in data) {
        const options = data[trait];
        if (options && options.length > 0) {
            selections[trait] = options[Math.floor(Math.random() * options.length)].value;
        } else {
            console.warn(`Aucune option trouvée pour le trait ${trait}`);
        }
    }
    drawCharacter(); // Redessine le canvas avec les sélections aléatoires
}

// Fonction pour télécharger l'image
document.getElementById('downloadBtn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'character.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// Écouteur pour le bouton "randomize"
document.getElementById('randomizeBtn').addEventListener('click', randomizeSelections);

// Fonction pour générer un hash unique basé sur les sélections de traits
function generateTraitsHash(selections) {
    return JSON.stringify(selections);  // On peut utiliser un hash plus complexe si besoin
}

// Fonction pour vérifier si un hash existe dans localStorage
function isDuplicate(hash) {
    const existingHashes = JSON.parse(localStorage.getItem('uploadedTraitHashes')) || [];
    return existingHashes.includes(hash);
}

// Fonction pour ajouter un hash à localStorage
function addHashToStorage(hash) {
    let existingHashes = JSON.parse(localStorage.getItem('uploadedTraitHashes')) || [];
    existingHashes.push(hash);
    localStorage.setItem('uploadedTraitHashes', JSON.stringify(existingHashes));
}

//fonction pour vérifier si un wallet est connecté
async function getWalletAddress() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            return accounts.length > 0 ? accounts[0] : null;
        } catch (error) {
            console.error("Erreur lors de la récupération des comptes:", error);
            return null;
        }
    } else {
        alert("Veuillez installer MetaMask pour continuer.");
        return null;
    }
}



// Fonction pour charger l'image sur IPFS via Pinata
async function uploadToIPFS() {
    if (typeof window.ethereum === 'undefined') {
        alert("Veuillez installer MetaMask pour continuer.");
        return;
    }
    // Vérifiez si un wallet est connecté
    const address = await getWalletAddress();
    if (!address) {
        alert("Please connect your wallet before minting.");
        await connectWallet(); // Tentez de connecter le portefeuille
        if (!await getWalletAddress()) {  // Re-vérification après tentative de connexion
            console.log("Wallet connection is required for minting.");
            return; // Arrête l'exécution si l'utilisateur n'a toujours pas connecté son wallet
        }
    }
    console.log("Wallet connected:", address);


    const apiKey = "a197b1b0970c8ae5430b";
    const secretApiKey = "0323af01dc049c026d6cede063d90ef0cde11d0bdc07fbd9a472811d30028dd3";

    // Générer le hash de la sélection actuelle
    const traitsHash = generateTraitsHash(selections);

    // Vérifier si l'image avec ces traits a déjà été uploadée
    if (isDuplicate(traitsHash)) {
        alert("An image with this combination of traits has already been generated.");
        return;
    }

    let uploadCount = parseInt(localStorage.getItem('uploadCount')) || 0;
    uploadCount += 1;
    localStorage.setItem('uploadCount', uploadCount);
    const fileName = `Dgenz#${uploadCount}.png`;

    const imageData = canvas.toDataURL('image/png');
    const blob = await (await fetch(imageData)).blob();
    const formData = new FormData();
    formData.append("file", blob, fileName);

    showMintingProgress(); // Appelle la fonction pour montrer les étapes

    try {
        // Étape 1 : Upload de l'image
        const imageResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: {
                "pinata_api_key": apiKey,
                "pinata_secret_api_key": secretApiKey
            },
            body: formData
        });

        const step1 = document.getElementById('step1');
        if (imageResponse.ok) {
            const imageResult = await imageResponse.json();
            const ipfsImageUrl = `https://gateway.pinata.cloud/ipfs/${imageResult.IpfsHash}`;
            console.log("Image uploaded to IPFS:", ipfsImageUrl);

            step1.innerHTML = '<span class="checkmark">✔️</span> Image uploaded successfully!';

            // Crée les métadonnées
            const metadata = {
                name: `Dgenz #${uploadCount}`,
                description: "A unique Dgenz character",
                image: ipfsImageUrl,
                attributes: [
                    { trait_type: "Background", value: selections.background },
                    { trait_type: "Type", value: selections.type },
                    { trait_type: "Glasses", value: selections.glasses },
                    { trait_type: "Top Head", value: selections.tophead },
                    { trait_type: "Neck", value: selections.neck }
                ]
            };

            const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
            const metadataFormData = new FormData();
            metadataFormData.append("file", metadataBlob, `Dgenz#${uploadCount}_metadata.json`);

            // Étape 2 : Upload des métadonnées
            const metadataResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
                method: "POST",
                headers: {
                    "pinata_api_key": apiKey,
                    "pinata_secret_api_key": secretApiKey
                },
                body: metadataFormData
            });

            const step2 = document.getElementById('step2');
            if (metadataResponse.ok) {
                const metadataResult = await metadataResponse.json();
                const ipfsMetadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataResult.IpfsHash}`;
                console.log("Metadata uploaded to IPFS:", ipfsMetadataUrl);
                step2.innerHTML = '<span class="checkmark">✔️</span> Metadata uploaded successfully!';

                addHashToStorage(traitsHash);

                const mintSuccess = await mintNFT(ipfsMetadataUrl);
                const step3 = document.getElementById('step3');

                if (mintSuccess) {
                    step3.innerHTML = '<span class="checkmark">✔️</span> NFT minted successfully!';
                    
                    // Lien vers le NFT sur OpenSea
                    const openseaLink = document.createElement('a');
                    openseaLink.href = `https://testnets.opensea.io/assets/base-sepolia/${contractAddress}/${uploadCount}`;
                    openseaLink.target = "_blank";
                    openseaLink.textContent = "View your NFT on OpenSea";
                    openseaLink.style.display = "block";
                    openseaLink.style.marginTop = "10px";
                    step3.appendChild(openseaLink);
                } else {
                    // Mettez à jour le pop-up pour indiquer l'échec
                    step3.innerHTML = '<span class="error">❌ Minting failed. Please check MetaMask.</span>';
                }
            } else {
                console.error("Failed to upload metadata to IPFS", metadataResponse.statusText);
                step2.innerHTML = '<span class="error">❌ Failed to upload metadata</span>';
            }
        } else {
            console.error("Failed to upload image to IPFS", imageResponse.statusText);
            step1.innerHTML = '<span class="error">❌ Failed to upload image</span>';
        }
    } catch (error) {
        console.error("Error uploading to IPFS:", error);
    }
}


//Fenetre popup
function showMintingProgress() {
    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.id = 'popupOverlay';
    overlay.className = 'overlay';
    overlay.style.display = 'block'; // Afficher l'overlay
    document.body.appendChild(overlay);

    // Créer la pop-up de progression
    const progressContainer = document.createElement('div');
    progressContainer.id = 'mintingPopup';
    progressContainer.className = 'popup';
    progressContainer.style.display = 'block'; // Afficher la pop-up

    // HTML de la pop-up avec le bouton "Fermer" masqué initialement
    progressContainer.innerHTML = `
        <div class="popup-content" style="position: relative;">
            <span class="close" id="closeProgressPopup" style="display: none; position: absolute; top: 10px; right: 10px; font-size: 24px; font-weight: bold; cursor: pointer;">&times;</span>
            <h2>Minting in Progress</h2>
            <ul>
                <li id="step1" class="step"><span class="loader"></span> Uploading image to IPFS...</li>
                <li id="step2" class="step"><span class="loader"></span> Uploading metadata to IPFS...</li>
                <li id="step3" class="step"><span class="loader"></span> Minting NFT...</li>
            </ul>
        </div>
    `;

    document.body.appendChild(progressContainer);

    // Désactiver le scroll de la page
    document.body.style.overflow = 'hidden';

    // Écouteur pour fermer la pop-up et l'overlay
    document.getElementById('closeProgressPopup').addEventListener('click', () => {
        document.body.removeChild(progressContainer);
        document.body.removeChild(overlay);
        document.body.style.overflow = 'auto'; // Réactiver le scroll de la page
        location.reload(); // Rafraîchir la page
    });

    // Simuler la fin du processus de minting
    // Remplacez ceci par la logique de votre minting
    setTimeout(() => {
        // Afficher le bouton de fermeture lorsque le minting est terminé
        document.getElementById('closeProgressPopup').style.display = 'block';
    }, 5000); // Simuler un délai de 5 secondes pour le minting
}





//MINT FUNCTION
document.addEventListener("DOMContentLoaded", function() {
    const mintButton = document.getElementById('mintNFTBtn');
    if (mintButton) {
        mintButton.addEventListener('click', async () => {
            mintButton.disabled = true;  // Désactiver temporairement le bouton pour éviter les doubles clics
            try {
                const ipfsMetadataUrl = document.querySelector('#ipfsLinkContainer a')?.href;
                if (!ipfsMetadataUrl) {
                    return;
                }
                await mintNFT(ipfsMetadataUrl);
            } finally {
                mintButton.disabled = false;  // Réactiver le bouton après le processus
            }
        }, { once: true });  // Ajouter l'écouteur une seule fois
    }
});


// Écouteurs pour les boutons
document.getElementById('mintNFTBtn').addEventListener('click', uploadToIPFS);

// Charger les traits JSON au démarrage de la page
window.onload = loadTraits;


// Fonction pour vérifier la limite de mint
async function checkMintLimit() {
    // Connecter MetaMask
    await ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const nftContract = new ethers.Contract(contractAddress, abi, signer);

    try {
        const userAddress = await signer.getAddress();
        const mintedCount = await nftContract.mintCount(userAddress);
        const maxMintPerWallet = await nftContract.MAX_MINT_PER_WALLET();

        const mintButton = document.getElementById("mintNFTBtn");
        const mintLimitMessage = document.getElementById("mintLimitMessage");

        if (mintedCount >= maxMintPerWallet) {
            mintButton.disabled = true; // Désactive le bouton
            mintButton.textContent = "Max mint limit reached"; // Change le texte du bouton
            mintLimitMessage.textContent = `You have reached the max mint limit of ${maxMintPerWallet} NFTs.`;
        } else {
            mintButton.disabled = false; // Active le bouton si la limite n'est pas atteinte
            mintButton.textContent = "Mint NFT"; // Change le texte du bouton à son état original
            mintLimitMessage.textContent = ""; // Retire tout message de limite
        }
    } catch (error) {
        console.error("Erreur lors de la vérification de la limite de mint:", error);
    }
}

// Vérifier la limite de mint dès le chargement de la page
window.addEventListener("load", checkMintLimit);

//Nombre de NFT mintés
async function updateTotalMinted() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const nftContract = new ethers.Contract(contractAddress, abi, provider);

    try {
        // Récupérer le nombre total de NFTs mintés
        const totalMinted = await nftContract.totalSupply();
        const maxSupply = await nftContract.MAX_SUPPLY(); // Récupérer MAX_SUPPLY

        // Mettre à jour le texte pour afficher "totalMinted / maxSupply"
        document.getElementById("totalMintedDisplay").textContent = `Total NFTs Minted: ${totalMinted} / ${maxSupply}`;
    } catch (error) {
        console.error("Erreur lors de la récupération du nombre total de NFTs mintés:", error);
    }
}

// Appeler cette fonction dès le chargement de la page
window.addEventListener("load", updateTotalMinted);