<?php
    $date = $_POST['date'];
    $events = array();
    for ($i=0; $i < 10; $i++) { 
        $events[$i]['date'] = $date;
        $events[$i]['title'] = 'Title of Event '.( $i + 1 );
        $events[$i]['description'] = 'Description of Event '.( $i + 1 );
    }
    echo json_encode($events);
?>