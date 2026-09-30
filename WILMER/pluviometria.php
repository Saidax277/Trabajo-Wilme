<?php
    $archivo = "pluviometria.txt";

    // Verificamos si el archivo existe para evitar errores
    if (file_exists($archivo)) {
        $pluviometria = file_get_contents($archivo);
        
        // Forma correcta de imprimir la variable concatenando la etiqueta HTML
        echo $pluviometria . "<br>";
        
        // O también puedes hacerlo así dentro de las comillas dobles:
        // echo "$pluviometria <br>";
    } else {
        echo "El archivo de pluviometría no existe o la ruta es incorrecta.<br>";
    }
?>