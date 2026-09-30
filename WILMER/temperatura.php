<?php
    $archivo = "temperatura.txt";

    // Verificamos si el archivo existe antes de intentar leerlo
    if (file_exists($archivo)) {
        $temperatura = file_get_contents($archivo);
        echo $temperatura;
    } else {
        echo "Error: El archivo temperatura.txt no existe o no se encuentra en la ruta especificada.";
    }
?>